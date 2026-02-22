/**
 * One deterministic mathematician per user. Same user.id always gets the same name.
 * Used for chat label, sidebar, and tutor context.
 */
const FAMOUS_MATHEMATICIANS = [
  'Euler',
  'Gauss',
  'Riemann',
  'Fermat',
  'Pascal',
  'Descartes',
  'Leibniz',
  'Newton',
  'Archimedes',
  'Euclid',
  'Pythagoras',
  'Hypatia',
  'Cantor',
  'Noether',
  'Lovelace',
  'Turing',
  'Shannon',
  'Gödel',
  'Poincaré',
  'Ramanujan',
  'Laplace',
  'Lagrange',
  'Cauchy',
  'Bernoulli',
  'Galois',
  'Abel',
  'Diophantus',
  'al-Khwarizmi',
  'Bhaskara',
  'Kovalevskaya',
  'Germain',
  'Dedekind',
  'Hilbert',
  'Kolmogorov',
  'von Neumann',
  'Ptolemy',
  'Fibonacci',
  'Cardano',
  'Viète',
  'Brahmagupta',
  'Omar Khayyam',
  'Tartaglia',
  'Bombelli',
  'Napier',
  'Kepler',
  'Galileo',
  'Cavalieri',
  'Wallis',
  'Brouwer',
  'Hausdorff',
  'Lebesgue',
  'Borel',
  'Banach',
  'Bourbaki',
]

export function getMathematicianForUser(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i)
  }
  const index = Math.abs(hash) % FAMOUS_MATHEMATICIANS.length
  return FAMOUS_MATHEMATICIANS[index]
}
