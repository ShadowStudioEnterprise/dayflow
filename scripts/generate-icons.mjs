import { readFile, mkdir, access, readdir } from 'node:fs/promises'
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

// Reuse the existing vector mark; PNGs are reproducible assets, not a second logo.
const svg = await readFile(
  new URL('../public/favicon.svg', import.meta.url),
  'utf8',
)
const square = svg.replace('rx="18"', 'rx="0"')
const maskable = square.replace(
  '<g ',
  '<g transform="translate(8 8) scale(.75)" ',
)
const icons = new URL('../public/icons/', import.meta.url)
await mkdir(icons, { recursive: true })
for (const [name, size, source] of [
  ['icon-192.png', 192, svg],
  ['icon-512.png', 512, svg],
  ['maskable-512.png', 512, maskable],
  ['apple-touch-icon.png', 180, square],
])
  await sharp(Buffer.from(source))
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(name, icons)))

const nativePath = new URL(
  '../ios/App/App/Assets.xcassets/AppIcon.appiconset/',
  import.meta.url,
)
if (
  await access(nativePath).then(
    () => true,
    () => false,
  )
)
  await sharp(Buffer.from(square))
    .resize(1024, 1024)
    .removeAlpha()
    .png()
    .toFile(fileURLToPath(new URL('AppIcon-512@2x.png', nativePath)))
for (const [density, size] of [
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
]) {
  const directory = new URL(
    `../android/app/src/main/res/mipmap-${density}/`,
    import.meta.url,
  )
  if (
    !(await access(directory).then(
      () => true,
      () => false,
    ))
  )
    continue
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png'])
    await sharp(Buffer.from(square))
      .resize(size, size)
      .png()
      .toFile(fileURLToPath(new URL(name, directory)))
}
console.log('Iconos web y nativos disponibles actualizados.')

const splashDirectories = [
  new URL('../ios/App/App/Assets.xcassets/Splash.imageset/', import.meta.url),
]
const androidResources = new URL(
  '../android/app/src/main/res/',
  import.meta.url,
)
if (
  await access(androidResources).then(
    () => true,
    () => false,
  )
)
  for (const name of await readdir(androidResources))
    if (name.startsWith('drawable'))
      splashDirectories.push(new URL(`${name}/`, androidResources))
for (const directory of splashDirectories) {
  if (
    !(await access(directory).then(
      () => true,
      () => false,
    ))
  )
    continue
  for (const name of await readdir(directory)) {
    if (!/^splash.*\.png$/i.test(name)) continue
    const path = fileURLToPath(new URL(name, directory))
    const { width, height } = await sharp(path).metadata()
    const size = Math.round(Math.min(width, height) * 0.28)
    const mark = await sharp(Buffer.from(square))
      .resize(size, size)
      .png()
      .toBuffer()
    await sharp({
      create: { width, height, channels: 3, background: '#7562b4' },
    })
      .composite([{ input: mark, gravity: 'centre' }])
      .png()
      .toFile(path)
  }
}
