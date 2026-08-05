/** Giữ chỗ cho các tab sẽ bổ sung ở đợt sau, để cấu trúc 6 tab đúng ngay từ đầu. */
function PlaceholderTab({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#c1c9c0] bg-[#fbf9f1] p-12 text-center">
      <span className="material-symbols-outlined text-[36px] text-[#c1c9c0]">construction</span>
      <h3 className="text-sm font-bold text-[#414942]">{title}</h3>
      <p className="max-w-md text-sm text-[#717971]">{description}</p>
    </div>
  )
}

export default PlaceholderTab
