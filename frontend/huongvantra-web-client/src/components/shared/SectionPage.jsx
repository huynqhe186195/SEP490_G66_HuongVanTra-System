import { loadAuthSession } from '../../features/auth/services/authSession.js'
import PageHeader from './PageHeader.jsx'
import { formatDisplayName } from '../../features/auth/services/authSession.js'

function SectionPage({ title, description, searchPlaceholder = 'Tìm kiếm...', children }) {
  const authSession = loadAuthSession()
  const userLabel = formatDisplayName(authSession?.username) || 'Admin'

  return (
    <div className="flex h-full flex-col gap-6">
      <PageHeader title={title} description={description} searchPlaceholder={searchPlaceholder} userLabel={userLabel} />

      <section className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <h2 className="mb-3 text-3xl font-bold text-gray-800">{title}</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-gray-500">{description}</p>

        {children}
      </section>
    </div>
  )
}

export default SectionPage