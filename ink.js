// Rubber-stamp ink: rough edges, a darker rim where the ink pools, dry spots, and
// pressure falling off to one side. Shared by anything that wants to look pressed.

export function inkFilter({ id, amount = 0.5, seedA = 3, seedB = 11 }) {
  const roughness = 2.2 * amount;
  const body = 1 - 0.45 * amount; // thick areas lighten; edges keep full ink
  const voidSlope = 1 + 1.8 * amount;
  const voidIntercept = 2.2 - 0.7 * amount;
  return `<filter id="${id}" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seedA}" result="grain"/>
    <feDisplacementMap in="SourceGraphic" in2="grain" scale="${roughness}" xChannelSelector="R" yChannelSelector="G" result="rough"/>
    <feMorphology in="rough" operator="erode" radius="0.8" result="inner"/>
    <feComposite in="rough" in2="inner" operator="out" result="rim"/>
    <feComponentTransfer in="rough" result="body"><feFuncA type="linear" slope="${body}"/></feComponentTransfer>
    <feMerge result="inked"><feMergeNode in="body"/><feMergeNode in="rim"/></feMerge>
    <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="${seedB}" result="blotch"/>
    <feComponentTransfer in="blotch" result="coverage"><feFuncA type="linear" slope="${-voidSlope}" intercept="${voidIntercept}"/></feComponentTransfer>
    <feComposite in="inked" in2="coverage" operator="in"/>
  </filter>`;
}

export function pressureMask({ id, angle = 30, amount = 0.4, size = 100 }) {
  const low = Math.round((1 - amount * 0.8) * 255);
  return `<linearGradient id="g-${id}" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="rgb(${low} ${low} ${low})"/>
    </linearGradient>
    <mask id="${id}" maskUnits="userSpaceOnUse" x="-20" y="-20" width="${size + 40}" height="${size + 40}">
      <rect x="-20" y="-20" width="${size + 40}" height="${size + 40}" fill="url(#g-${id})"/>
    </mask>`;
}
