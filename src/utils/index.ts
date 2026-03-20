export function createPageUrl(pageName: string): string {
  if (!pageName) return '/';
  
  return '/' + pageName
    .replace(/([a-z])([A-Z])/g, '$1-$2') // Adds dash between CamelCase (AdminDashboard -> Admin-Dashboard)
    .replace(/\s+/g, '-')                // Replaces spaces with dashes
    .toLowerCase();                      // Makes it all lowercase (/admin-dashboard)
}