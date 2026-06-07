function tabClass(active) {
  return active
    ? 'border-2 border-[#356647] bg-[#356647] text-white'
    : 'border-2 border-[#356647] bg-white text-[#356647] hover:bg-[#356647]/5'
}

function ViewTabs({ view, onViewChange, restoreCount = 0 }) {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => onViewChange('active')}
        className={`inline-flex min-h-[48px] min-w-[160px] flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-base font-bold transition-all sm:flex-none ${tabClass(view === 'active')}`}
      >
        <span className="material-symbols-outlined text-[24px]">check_circle</span>
        Đang sử dụng
      </button>
      <button
        type="button"
        onClick={() => onViewChange('restore')}
        className={`inline-flex min-h-[48px] min-w-[160px] flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-base font-bold transition-all sm:flex-none ${tabClass(view === 'restore')}`}
      >
        <span className="material-symbols-outlined text-[24px]">restore</span>
        Khôi phục ({restoreCount})
      </button>
    </div>
  )
}

export default ViewTabs
