import type { Place } from './types'

/**
 * Brazilian capitals and the larger cities and usual shooting places, with their coordinates and UTC offset (Brazil
 * has had no daylight saving time since 2019). Coordinates are to a few hundredths of a degree: under a minute of
 * difference in the sun's times. Anywhere else: coordinates typed or pasted from a map.
 */
const C = (name: string, lat: number, lon: number, tz = -3): Place => ({ name, lat, lon, tz })

export const BR_CITIES: Place[] = [
  // capitals
  C('Aracaju - SE', -10.911, -37.072),
  C('Belém - PA', -1.456, -48.49),
  C('Belo Horizonte - MG', -19.917, -43.934),
  C('Boa Vista - RR', 2.82, -60.672, -4),
  C('Brasília - DF', -15.794, -47.882),
  C('Campo Grande - MS', -20.469, -54.62, -4),
  C('Cuiabá - MT', -15.601, -56.097, -4),
  C('Curitiba - PR', -25.429, -49.271),
  C('Florianópolis - SC', -27.595, -48.548),
  C('Fortaleza - CE', -3.732, -38.527),
  C('Goiânia - GO', -16.686, -49.264),
  C('João Pessoa - PB', -7.115, -34.864),
  C('Macapá - AP', 0.035, -51.07),
  C('Maceió - AL', -9.665, -35.735),
  C('Manaus - AM', -3.119, -60.022, -4),
  C('Natal - RN', -5.795, -35.209),
  C('Palmas - TO', -10.184, -48.334),
  C('Porto Alegre - RS', -30.035, -51.218),
  C('Porto Velho - RO', -8.762, -63.904, -4),
  C('Recife - PE', -8.047, -34.877),
  C('Rio Branco - AC', -9.975, -67.81, -5),
  C('Rio de Janeiro - RJ', -22.907, -43.173),
  C('Salvador - BA', -12.971, -38.501),
  C('São Luís - MA', -2.53, -44.303),
  C('São Paulo - SP', -23.55, -46.633),
  C('Teresina - PI', -5.089, -42.802),
  C('Vitória - ES', -20.315, -40.312),
  // São Paulo
  C('Bauru - SP', -22.315, -49.061),
  C('Campinas - SP', -22.906, -47.061),
  C('Campos do Jordão - SP', -22.739, -45.591),
  C('Guarulhos - SP', -23.454, -46.533),
  C('Ilhabela - SP', -23.778, -45.358),
  C('Jundiaí - SP', -23.186, -46.884),
  C('Osasco - SP', -23.532, -46.792),
  C('Piracicaba - SP', -22.725, -47.649),
  C('Ribeirão Preto - SP', -21.178, -47.81),
  C('Santo André - SP', -23.664, -46.538),
  C('Santos - SP', -23.961, -46.333),
  C('São Bernardo do Campo - SP', -23.694, -46.565),
  C('São José do Rio Preto - SP', -20.82, -49.379),
  C('São José dos Campos - SP', -23.18, -45.887),
  C('Sorocaba - SP', -23.501, -47.458),
  C('Ubatuba - SP', -23.434, -45.071),
  // Rio de Janeiro
  C('Angra dos Reis - RJ', -23.006, -44.318),
  C('Armação dos Búzios - RJ', -22.747, -41.882),
  C('Cabo Frio - RJ', -22.879, -42.019),
  C('Campos dos Goytacazes - RJ', -21.754, -41.324),
  C('Duque de Caxias - RJ', -22.786, -43.312),
  C('Niterói - RJ', -22.883, -43.104),
  C('Nova Iguaçu - RJ', -22.759, -43.451),
  C('Paraty - RJ', -23.219, -44.713),
  C('Petrópolis - RJ', -22.505, -43.179),
  C('Teresópolis - RJ', -22.412, -42.966),
  C('Volta Redonda - RJ', -22.523, -44.104),
  // Minas Gerais
  C('Contagem - MG', -19.932, -44.054),
  C('Diamantina - MG', -18.243, -43.6),
  C('Ipatinga - MG', -19.468, -42.537),
  C('Juiz de Fora - MG', -21.764, -43.35),
  C('Montes Claros - MG', -16.735, -43.862),
  C('Ouro Preto - MG', -20.386, -43.504),
  C('Tiradentes - MG', -21.11, -44.178),
  C('Uberaba - MG', -19.747, -47.932),
  C('Uberlândia - MG', -18.918, -48.277),
  // Espírito Santo
  C('Guarapari - ES', -20.672, -40.497),
  C('Serra - ES', -20.128, -40.307),
  C('Vila Velha - ES', -20.33, -40.292),
  // Paraná
  C('Cascavel - PR', -24.955, -53.455),
  C('Foz do Iguaçu - PR', -25.547, -54.588),
  C('Londrina - PR', -23.304, -51.169),
  C('Maringá - PR', -23.42, -51.933),
  C('Ponta Grossa - PR', -25.095, -50.162),
  // Santa Catarina
  C('Balneário Camboriú - SC', -26.991, -48.635),
  C('Blumenau - SC', -26.919, -49.066),
  C('Chapecó - SC', -27.1, -52.615),
  C('Criciúma - SC', -28.678, -49.37),
  C('Joinville - SC', -26.304, -48.846),
  // Rio Grande do Sul
  C('Canoas - RS', -29.918, -51.184),
  C('Caxias do Sul - RS', -29.168, -51.179),
  C('Gramado - RS', -29.379, -50.874),
  C('Passo Fundo - RS', -28.262, -52.407),
  C('Pelotas - RS', -31.772, -52.342),
  C('Rio Grande - RS', -32.035, -52.099),
  C('Santa Maria - RS', -29.684, -53.807),
  // Bahia
  C('Feira de Santana - BA', -12.267, -38.966),
  C('Ilhéus - BA', -14.789, -39.049),
  C('Juazeiro - BA', -9.416, -40.503),
  C('Lençóis - BA', -12.563, -41.39),
  C('Porto Seguro - BA', -16.449, -39.065),
  C('Vitória da Conquista - BA', -14.861, -40.844),
  // Pernambuco
  C('Caruaru - PE', -8.284, -35.97),
  C('Fernando de Noronha - PE', -3.854, -32.424, -2),
  C('Jaboatão dos Guararapes - PE', -8.113, -35.015),
  C('Olinda - PE', -8.009, -34.855),
  C('Petrolina - PE', -9.389, -40.503),
  // other Northeast
  C('Arapiraca - AL', -9.752, -36.661),
  C('Barreirinhas - MA', -2.759, -42.826),
  C('Campina Grande - PB', -7.23, -35.881),
  C('Imperatriz - MA', -5.526, -47.479),
  C('Jijoca de Jericoacoara - CE', -2.795, -40.513),
  C('Juazeiro do Norte - CE', -7.213, -39.315),
  C('Mossoró - RN', -5.188, -37.344),
  C('Parnaíba - PI', -2.904, -41.776),
  C('Sobral - CE', -3.689, -40.349),
  // North
  C('Araguaína - TO', -7.191, -48.207),
  C('Cruzeiro do Sul - AC', -7.631, -72.67, -5),
  C('Ji-Paraná - RO', -10.885, -61.951, -4),
  C('Marabá - PA', -5.368, -49.117),
  C('Parintins - AM', -2.628, -56.736, -4),
  C('Santarém - PA', -2.443, -54.708),
  // Center-West
  C('Alto Paraíso de Goiás - GO', -14.132, -47.51),
  C('Anápolis - GO', -16.328, -48.953),
  C('Bonito - MS', -21.127, -56.482, -4),
  C('Chapada dos Guimarães - MT', -15.461, -55.75, -4),
  C('Corumbá - MS', -19.009, -57.653, -4),
  C('Dourados - MS', -22.221, -54.806, -4),
  C('Pirenópolis - GO', -15.852, -48.958),
  C('Rondonópolis - MT', -16.47, -54.636, -4)
]

const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** The city of the list with this name (accents, capitals and spaces do not matter). */
export function findCity(name: string): Place | undefined {
  const q = fold(name)
  return BR_CITIES.find((c) => fold(c.name) === q)
}

/**
 * Coordinates typed ("-23.5505, -46.6333") or in a map link ("…/@-23.58,-46.65,15z", "…?q=-22.95,-43.21");
 * null when there are none or they are off the globe.
 */
export function parseCoords(text: string): { lat: number; lon: number } | null {
  const n = '(-?\\d{1,3}(?:\\.\\d+)?)'
  const found =
    new RegExp(`@${n},${n}`).exec(text) ??
    new RegExp(`[?&](?:q|ll|query)=${n},${n}`).exec(text) ??
    new RegExp(`^\\s*${n}\\s*[,;\\s]\\s*${n}\\s*$`).exec(text)
  if (!found) return null
  const lat = Number(found[1])
  const lon = Number(found[2])
  if (!(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) return null
  return { lat, lon }
}
