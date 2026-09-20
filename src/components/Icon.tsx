type IconName = 'arrow' | 'plus' | 'share' | 'book' | 'upload' | 'check' | 'close' | 'left' | 'download'
const paths: Record<IconName, string> = {
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  left: 'M20 12H4m6-6-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  share: 'M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7',
  book: 'M12 5v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
  download: 'M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4',
}
export default function Icon({ name }: { name: IconName }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
