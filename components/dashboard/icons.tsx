// 통계 카드용 최소 라인 아이콘. 외부 아이콘 라이브러리 없이 순수 SVG로 직접 그린다(원본
// 레퍼런스 이미지의 일러스트를 베끼지 않기 위해 아주 단순한 기하학 도형만 사용).
const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 } as const;

export function FolderIcon() {
  return (
    <svg {...common}>
      <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" strokeLinejoin="round" />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg {...common}>
      <path d="M6 9a6 6 0 0 1 12 0v5l1.5 3h-15L6 14V9Z" strokeLinejoin="round" />
      <path d="M10 20a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg {...common}>
      <path d="M4 12a8 8 0 0 1 14-5.2M20 12a8 8 0 0 1-14 5.2" strokeLinecap="round" />
      <path d="M18 4v4h-4M6 20v-4h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
