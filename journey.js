// The chapters of my journey, in order. The hero and the stamp lab both read this.
// status: 'left' for chapters I've moved on from (exit stamp), 'current' for the one I'm in (entry stamp).
// x/y are % of the hero, rot is the resting direction of the tilt.
// narrowX and narrowY replace x and y on phones, where the same percentages leave the row lopsided
// and the stamps don't read as one ring.

export const JOURNEY = [
  {
    key: 'ukraine', status: 'left', x: 11, narrowX: 17, y: 24, narrowY: 30, rot: -1, ink: 'blue',
    note: 'Anna was born and raised in Ukraine.',
    top: 'Origin', mark: { word: 'Ukraine', sub: 'Україна' }, date: 'Left 2012',
    frames: { mixed: 'rect', passport: 'rect', postmark: 'squared' },
  },
  {
    key: 'risd', status: 'left', x: 34, narrowX: 47, y: 20, rot: 1, ink: 'violet',
    note: 'Anna studied industrial design at RISD, class of 2016.',
    layout: 'seal', top: 'Rhode Island School of Design', bottom: 'Class of 2016', mark: { logo: 'risd' }, date: '2012–2016',
    frames: { mixed: 'circle', passport: 'circle', postmark: 'circle' },
  },
  {
    key: 'stratasys', status: 'left', x: 82, narrowX: 80, y: 18, narrowY: 28, rot: -1, ink: 'navy',
    note: 'Anna’s first job: product designer at Stratasys.',
    top: 'First job', bottom: 'Product designer', mark: { logo: 'stratasys' }, date: '2016–2019',
    frames: { mixed: 'postage', passport: 'rect', postmark: 'circle' },
  },
  {
    key: 'singapore', status: 'left', x: 88, narrowX: 82, y: 66, rot: -1, ink: 'red',
    note: 'Anna lived in Singapore for five years.',
    top: 'Home for 5 years', mark: { word: 'Singapore', emblem: 'crescent' }, date: '2019–2023',
    frames: { mixed: 'rect', passport: 'rect', postmark: 'squared' },
  },
  {
    key: 'grab', status: 'left', x: 73, y: 80, rot: 1, ink: 'red',
    note: 'Anna grew from designer to lead at Grab, redesigning its homepage for 187M+ people.',
    top: 'Designer → Lead', bottom: 'Homepage · 187M+', mark: { logo: 'grab' }, date: '2019–2023',
    frames: { mixed: 'octagon', passport: 'rect', postmark: 'circle' },
  },
  {
    key: 'fay', status: 'left', x: 27, y: 80, rot: -1, ink: 'violet',
    note: 'Anna joined Fay as its founding designer, then led design.',
    top: 'Founding designer', bottom: 'Design lead', mark: { logo: 'fay' }, date: '2023–2026',
    frames: { mixed: 'rect', passport: 'rect', postmark: 'squared' },
  },
  {
    key: 'southamerica', status: 'current', x: 10, narrowX: 17, y: 62, narrowY: 65, rot: 1, ink: 'green',
    note: 'Anna is travelling South America, October to January.',
    top: 'En ruta', mark: { word: 'South America' }, date: '13 Oct 2026',
    frames: { mixed: 'oval', passport: 'rect', postmark: 'circle' },
  },
];
