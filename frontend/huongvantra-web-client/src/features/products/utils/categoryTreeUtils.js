export function buildCategoryTree(categories = []) {
  const nodes = new Map(
    categories.map((category) => [
      category.id,
      { ...category, children: [] },
    ]),
  )
  const roots = []

  for (const category of categories) {
    const node = nodes.get(category.id)
    if (!node) continue
    const parentId = category.parentId ?? null
    if (parentId && nodes.has(parentId)) {
      nodes.get(parentId).children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortNodes = (items) => {
    items.sort((a, b) => String(a.name).localeCompare(String(b.name), 'vi'))
    items.forEach((item) => sortNodes(item.children))
  }
  sortNodes(roots)

  return roots
}

export function getCategoryById(categories = [], categoryId) {
  if (!categoryId) return null
  return categories.find((item) => String(item.id) === String(categoryId)) || null
}

export function getCategoryPathParts(categories = [], categoryId) {
  const parts = []
  const guard = new Set()
  let current = getCategoryById(categories, categoryId)

  while (current && !guard.has(String(current.id))) {
    guard.add(String(current.id))
    parts.unshift(current.name)
    current = current.parentId ? getCategoryById(categories, current.parentId) : null
  }

  return parts
}

export function getCategoryPathLabel(categories = [], categoryId, fallbackName, emptyLabel = '—') {
  const parts = getCategoryPathParts(categories, categoryId)
  if (parts.length) return parts.join(' > ')
  if (fallbackName) return fallbackName
  return categoryId ? `Danh mục #${categoryId}` : emptyLabel
}

export function flattenCategoryTreeForSelect(categories = []) {
  const rows = []

  function walk(nodes, depth = 0, parentParts = []) {
    for (const node of nodes) {
      const pathParts = [...parentParts, node.name]
      rows.push({
        ...node,
        depth,
        pathParts,
        pathLabel: pathParts.join(' > '),
        selectLabel: `${'  '.repeat(depth)}${depth > 0 ? '└ ' : ''}${node.name}`,
      })
      if (node.children?.length) walk(node.children, depth + 1, pathParts)
    }
  }

  walk(buildCategoryTree(categories))
  return rows
}

export function isCategoryUnavailable(categories = [], categoryId) {
  if (!categoryId || categories.length === 0) return false
  const category = getCategoryById(categories, categoryId)
  return !category || category.isDeleted || category.isActive === false
}

export function collectDescendantIds(categoryId, categories = []) {
  const childrenByParent = new Map()
  for (const category of categories) {
    const parentId = category.parentId ?? null
    if (!parentId) continue
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, [])
    childrenByParent.get(parentId).push(category.id)
  }

  const result = []
  const stack = [...(childrenByParent.get(categoryId) ?? [])]
  while (stack.length > 0) {
    const id = stack.pop()
    result.push(id)
    stack.push(...(childrenByParent.get(id) ?? []))
  }
  return result
}

export function expandCategoryFilterIds(selectedIds = [], categories = []) {
  const expanded = new Set()
  for (const rawId of selectedIds) {
    const id = Number(rawId)
    if (!id) continue
    expanded.add(id)
    for (const childId of collectDescendantIds(id, categories)) {
      expanded.add(childId)
    }
  }
  return expanded
}

export function filterCategoryTree(nodes = [], searchTerm = '') {
  const term = searchTerm.trim().toLowerCase()
  if (!term) return nodes

  function visit(node) {
    const nameMatches = String(node.name).toLowerCase().includes(term)
    const descriptionMatches = String(node.description || '').toLowerCase().includes(term)
    const matchedChildren = node.children.map(visit).filter(Boolean)
    if (!nameMatches && !descriptionMatches && matchedChildren.length === 0) return null
    return {
      ...node,
      children: matchedChildren,
    }
  }

  return nodes.map(visit).filter(Boolean)
}

export function collectTreeNodeIds(nodes = []) {
  const ids = []
  const walk = (items) => {
    for (const item of items) {
      ids.push(item.id)
      if (item.children?.length) walk(item.children)
    }
  }
  walk(nodes)
  return ids
}

export function formatCategoryFilterSummary(selectedIds = [], categories = []) {
  if (!selectedIds.length) return null
  const names = selectedIds
    .map((id) => categories.find((category) => category.id === id)?.name)
    .filter(Boolean)
  if (names.length === 0) return `${selectedIds.length} nhóm`
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]}, ${names[1]}`
  return `${names[0]}, ${names[1]} +${names.length - 2}`
}

export function buildCategoryParentOptions(categories = [], { excludeId = null } = {}) {
  const excludeSet = new Set()
  if (excludeId) {
    excludeSet.add(Number(excludeId))
    collectDescendantIds(excludeId, categories).forEach((id) => excludeSet.add(id))
  }

  const eligible = categories.filter(
    (category) => !category.isDeleted && category.isActive !== false && !excludeSet.has(category.id),
  )
  const tree = buildCategoryTree(eligible)
  const options = [{ value: '', label: '— Danh mục gốc (không có cha) —', depth: 0 }]

  function walk(nodes, depth) {
    for (const node of nodes) {
      options.push({ value: String(node.id), label: node.name, depth })
      if (node.children.length > 0) walk(node.children, depth + 1)
    }
  }
  walk(tree, 0)

  return options
}

export function getCategoryBreadcrumb(categoryId, categories = []) {
  return getCategoryPathParts(categories, categoryId).join(' › ')
}
