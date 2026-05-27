function SectionPage({ title, description, children }) {
  return (
    <div className="flex h-full flex-col gap-6">
      <header className="mb-8 flex items-center justify-between">
        <div className="border-b-2 border-[#538463] pb-1">
          <span className="text-sm font-medium text-[#538463]">{title}</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative w-64">
            <input
              className="w-full rounded-full border-none bg-[#EBF0E9] py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-[#538463]"
              placeholder="Tìm kiếm..."
              type="text"
            />
            <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </div>

          <div className="flex items-center gap-4 text-gray-600">
            <button type="button" className="hover:text-[#538463]">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
            <button type="button" className="hover:text-[#538463]">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
          </div>

          <div className="flex items-center">
            <img
              alt="User avatar"
              className="h-9 w-9 rounded-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAhD8En3wd_Ho2PlSiRzHa4VT-iVttfv5zGDVQSlO1RFzaKi5nfnglk9lD0NZbUMYlpsu4Bw0JE2DJv2Sp7ZzqW3DVx7QmjrgJFZK70fUM6PNCv9wPY2ndnyZbUbL3xLUeFZg3RdYA3_y7PtKLS2nvVlr211tVECRgnikO_m4hYJRQUBOsIZKFWTLONS_8PslOsjj8Tctssjdnlai5pzwgp-vau7e5x-YIysWIceRZtL1jKVSc2M6O877oLFQy9Qe53czBQYC5zJx1V"
            />
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <h2 className="mb-3 text-3xl font-bold text-gray-800">{title}</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-gray-500">{description}</p>

        {children}
      </section>
    </div>
  )
}

export default SectionPage