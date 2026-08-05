import { unzipSync } from 'fflate'

const MAX_ZIP_BYTES = 50 * 1024 * 1024
const MAX_EXCEL_BYTES = 25 * 1024 * 1024
const MAX_UNCOMPRESSED_ZIP_BYTES = 100 * 1024 * 1024
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
const IMAGE_MIME_TYPES = {
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizeMatchKey(value) {
  return normalizeText(value).toLocaleLowerCase('vi-VN')
}

function getBasename(path) {
  return String(path ?? '').split('/').pop()?.split('\\').pop() ?? ''
}

function getExtension(path) {
  const basename = getBasename(path)
  const dotIndex = basename.lastIndexOf('.')
  return dotIndex >= 0 ? basename.slice(dotIndex + 1).toLowerCase() : ''
}

function getStem(path) {
  const basename = getBasename(path)
  const dotIndex = basename.lastIndexOf('.')
  return dotIndex >= 0 ? basename.slice(0, dotIndex) : basename
}

function isIgnoredArchiveEntry(path) {
  const normalized = String(path ?? '').replaceAll('\\', '/')
  const basename = getBasename(normalized)
  return (
    !basename
    || normalized.endsWith('/')
    || normalized.startsWith('__MACOSX/')
    || basename.startsWith('._')
    || basename.toLowerCase() === 'thumbs.db'
  )
}

function isExcelEntry(path) {
  const basename = getBasename(path)
  return /\.xlsx$/i.test(basename) && !basename.startsWith('~$')
}

function isSupportedImageEntry(path) {
  return SUPPORTED_IMAGE_EXTENSIONS.has(getExtension(path))
}

function createBrowserFile(bytes, filename, type) {
  return new File([bytes], filename, { type })
}

function isImageStemForProduct(imageStem, productKey) {
  const normalizedStem = normalizeMatchKey(imageStem)
  const normalizedKey = normalizeMatchKey(productKey)
  if (!normalizedStem || !normalizedKey) return false
  if (normalizedStem === normalizedKey) return true
  if (!normalizedStem.startsWith(normalizedKey)) return false

  const suffix = normalizedStem.slice(normalizedKey.length)
  return /^(?:[_\-\s]\d+|\s*\(\d+\))$/.test(suffix)
}

function imageOrderForProduct(entry, productKey) {
  const stem = normalizeMatchKey(getStem(entry.path))
  const key = normalizeMatchKey(productKey)
  if (stem === key) return 0

  const suffix = stem.slice(key.length)
  const sequence = Number(suffix.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER)
  return Number.isFinite(sequence) ? sequence : Number.MAX_SAFE_INTEGER
}

export function isProductCreationZipFile(file) {
  return /\.zip$/i.test(file?.name ?? '')
}

export async function extractProductCreationZip(file) {
  if (!isProductCreationZipFile(file)) {
    throw new Error('File được chọn không phải định dạng .zip.')
  }
  if (file.size > MAX_ZIP_BYTES) {
    throw new Error('File ZIP tối đa 50MB.')
  }

  let entries
  let totalUncompressedBytes = 0
  let archiveTooLarge = false
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter(entry) {
        totalUncompressedBytes += Number(entry.originalSize ?? 0)
        if (totalUncompressedBytes > MAX_UNCOMPRESSED_ZIP_BYTES) {
          archiveTooLarge = true
          return false
        }
        return true
      },
    })
  } catch {
    throw new Error('Không thể giải nén file ZIP. Vui lòng kiểm tra file có bị hỏng hay không.')
  }
  if (archiveTooLarge) {
    throw new Error('Dữ liệu sau giải nén vượt quá 100MB.')
  }

  const archiveEntries = Object.entries(entries)
    .filter(([path]) => !isIgnoredArchiveEntry(path))
    .map(([path, bytes]) => ({ path, bytes }))

  const excelEntries = archiveEntries.filter((entry) => isExcelEntry(entry.path))
  if (excelEntries.length === 0) {
    throw new Error('File ZIP phải chứa đúng 1 file Excel định dạng .xlsx.')
  }
  if (excelEntries.length > 1) {
    throw new Error(`File ZIP đang có ${excelEntries.length} file Excel. Vui lòng chỉ giữ lại 1 file .xlsx.`)
  }

  const excelEntry = excelEntries[0]
  if (excelEntry.bytes.byteLength > MAX_EXCEL_BYTES) {
    throw new Error('File Excel trong ZIP tối đa 25MB.')
  }

  const images = archiveEntries
    .filter((entry) => isSupportedImageEntry(entry.path))
    .map((entry) => ({
      ...entry,
      filename: getBasename(entry.path),
      stem: getStem(entry.path),
      mimeType: IMAGE_MIME_TYPES[getExtension(entry.path)] ?? 'application/octet-stream',
    }))

  return {
    excelFile: createBrowserFile(
      excelEntry.bytes,
      getBasename(excelEntry.path),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ),
    excelFilename: getBasename(excelEntry.path),
    images,
  }
}

export function attachProductCreationZipImages({
  rows,
  images,
  createImageId,
  maxImagesPerProduct = 5,
  maxImageBytes = 5 * 1024 * 1024,
}) {
  const warnings = []
  const attachedByRow = new Map()
  const assignedPaths = new Set()

  rows.forEach((row) => {
    const productKey = normalizeText(row.clientKey)
    const matchingImages = images
      .filter((entry) => isImageStemForProduct(entry.stem, productKey))
      .sort((left, right) => {
        const orderDifference = imageOrderForProduct(left, productKey) - imageOrderForProduct(right, productKey)
        return orderDifference || left.filename.localeCompare(right.filename, 'vi')
      })

    matchingImages.forEach((entry) => assignedPaths.add(entry.path))

    const validImages = matchingImages.filter((entry) => {
      if (entry.bytes.byteLength <= maxImageBytes) return true
      warnings.push(`Ảnh "${entry.filename}" vượt quá 5MB nên đã bị bỏ qua.`)
      return false
    })

    if (validImages.length > maxImagesPerProduct) {
      warnings.push(`Sản phẩm ${productKey}: chỉ lấy ${maxImagesPerProduct} ảnh đầu tiên, ${validImages.length - maxImagesPerProduct} ảnh còn lại bị bỏ qua.`)
    }

    const attachedImages = validImages.slice(0, maxImagesPerProduct).map((entry, index) => ({
      id: createImageId(),
      file: createBrowserFile(entry.bytes, entry.filename, entry.mimeType),
      imageUrl: '',
      previewUrl: '',
      altText: row.name || entry.filename,
      sortOrder: index,
      isThumbnail: index === 0,
      uploading: false,
      pending: true,
    }))
    if (attachedImages.length > 0) attachedByRow.set(row, attachedImages)
  })

  const unmatched = images.filter((entry) => !assignedPaths.has(entry.path))
  if (unmatched.length > 0) {
    const examples = unmatched.slice(0, 5).map((entry) => entry.filename).join(', ')
    warnings.push(`${unmatched.length} ảnh không khớp Mã sản phẩm nên đã bị bỏ qua: ${examples}${unmatched.length > 5 ? ', ...' : ''}.`)
  }

  const nextRows = rows.map((row) => {
    return {
      ...row,
      images: attachedByRow.get(row) ?? [],
    }
  })
  const attachedCount = Array.from(attachedByRow.values()).reduce((total, productImages) => total + productImages.length, 0)

  return {
    rows: nextRows,
    attachedCount,
    matchedProductCount: attachedByRow.size,
    warnings,
  }
}
