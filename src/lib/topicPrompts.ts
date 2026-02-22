import type { MathTopicId } from '../../shared/metadataSchema'

/**
 * Example video prompts per topic. Picking one at random gives a "randomly generated"
 * topic in that field. The video API uses user metadata to personalize the explanation.
 */
export const TOPIC_VIDEO_PROMPTS: Record<MathTopicId, string[]> = {
  algebra: [
    'Explain how to solve quadratic equations by completing the square.',
    'Explain the difference between linear and quadratic functions with a visual.',
    'Explain why (a + b)² = a² + 2ab + b² geometrically.',
  ],
  linear_algebra: [
    'Explain Gaussian elimination and row echelon form.',
    'Explain what eigenvalues and eigenvectors mean geometrically.',
    'Explain the determinant as scaling factor for area or volume.',
  ],
  calculus: [
    'Explain the fundamental theorem of calculus with an intuitive example.',
    'Explain how the derivative gives the slope of a curve.',
    'Explain integration by substitution with a simple example.',
  ],
  real_analysis: [
    'Explain the epsilon-delta definition of a limit.',
    'Explain what it means for a sequence to be Cauchy.',
    'Explain the Bolzano–Weierstrass theorem intuitively.',
  ],
  geometry: [
    'Explain why the angles in a triangle sum to 180 degrees.',
    'Explain the Pythagorean theorem with a visual proof.',
    'Explain similarity and congruence of triangles.',
  ],
  topology: [
    'Explain what it means for a set to be open or closed.',
    'Explain connectedness with simple examples.',
    'Explain compactness in the reals (Heine–Borel).',
  ],
  probability: [
    'Explain the law of total probability with an example.',
    'Explain Bayes’ theorem with an intuitive example.',
    'Explain expected value and variance with a simple distribution.',
  ],
  statistics: [
    'Explain the central limit theorem intuitively.',
    'Explain hypothesis testing and p-values simply.',
    'Explain linear regression and the least squares line.',
  ],
  differential_equations: [
    'Explain separable differential equations with an example.',
    'Explain what a direction field tells us about solutions.',
    'Explain exponential growth and decay as a differential equation.',
  ],
  number_theory: [
    'Explain the Euclidean algorithm for GCD.',
    'Explain modular arithmetic and congruence.',
    'Explain why there are infinitely many primes.',
  ],
  discrete_math: [
    'Explain proof by induction with a simple example.',
    'Explain the pigeonhole principle with an example.',
    'Explain graph basics: vertices, edges, and degree.',
  ],
  optimization: [
    'Explain gradient descent intuitively.',
    'Explain linear programming and the simplex idea.',
    'Explain constrained optimization and Lagrange multipliers.',
  ],
  complex_analysis: [
    'Explain the complex plane and multiplication as rotation.',
    'Explain the Cauchy integral formula intuitively.',
    'Explain why e^(iπ) + 1 = 0.',
  ],
  abstract_algebra: [
    'Explain what a group is with simple examples.',
    'Explain cosets and quotient groups intuitively.',
    'Explain the first isomorphism theorem for groups.',
  ],
}

export function getRandomPromptForTopic(topic: string): string {
  const prompts = TOPIC_VIDEO_PROMPTS[topic as MathTopicId]
  if (!prompts?.length) return `Explain a key idea in ${topic.replace(/_/g, ' ')}.`
  return prompts[Math.floor(Math.random() * prompts.length)]
}
