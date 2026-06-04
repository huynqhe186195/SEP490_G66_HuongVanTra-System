import PageHeader from './PageHeader.jsx'

function SectionPage({ title, description, searchPlaceholder = 'Tìm kiếm...', children }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 sm:gap-6">
      <PageHeader title={title} description={description} searchPlaceholder={searchPlaceholder} />

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
        <h2 className="mb-3 text-2xl font-bold text-gray-800 sm:text-3xl">{title}</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-gray-500">{description}</p>

        {children}
      </section>
    </div>
  )
}

export default SectionPage