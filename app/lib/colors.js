// app/lib/colors.js
// Palette de couleurs centrale pour tout le projet Tricycle

export const colors = {
  // Couleurs principales
  primary: '#171717',    // Gris foncé - pour éléments neutres
  secondary: '#F25623',   // Orange - pour éléments principaux
  accent: '#F25623',     // Orange/Jaune - pour accents et highlights
  success: '#4D4D4D',     // Vert - pour succès et états positifs
  
  // Variations de couleurs
  gray: {
    50: '#f9fafb',    // Très clair
    100: '#f3f4f6',   // Clair
    200: '#e5e7eb',   // Moyen clair
    300: '#d1d5db',   // Moyen
    600: '#4b5563',   // Moyen foncé
    700: '#374151',   // Foncé
    800: '#1f2937',   // Très foncé
  },
  
  orange: {
    50: '#fff7ed',    // Très clair
    100: '#ffedd5',   // Clair
    200: '#fed7aa',   // Moyen clair
    300: '#fbbf24',   // Moyen
    600: '#ea580c',   // Moyen foncé
    700: '#c2410c',   // Foncé
    800: '#9a3412',   // Très foncé
  },
  
  yellow: {
    50: '#fefce8',    // Très clair
    100: '#fef9c3',   // Clair
    200: '#fef08a',   // Moyen clair
    300: '#fde047',   // Moyen
    600: '#d97706',   // Moyen foncé
    700: '#b45309',   // Foncé
    800: '#92400e',   // Très foncé
  },
  
  green: {
    50: '#f0fdf4',    // Très clair
    100: '#dcfce7',   // Clair
    200: '#bbf7d0',   // Moyen clair
    300: '#86efac',   // Moyen
    600: '#16a34a',   // Moyen foncé
    700: '#15803d',   // Foncé
    800: '#166534',   // Très foncé
  },
};

// Classes CSS personnalisées pour Tailwind
export const customColors = {
  'brand-primary': colors.primary,
  'brand-secondary': colors.secondary,
  'brand-accent': colors.accent,
  'brand-success': colors.success,
};
