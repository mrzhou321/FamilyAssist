const path = window.location.pathname

if (path.startsWith('/admin')) {
  await import('./admin/main')
} else if (path.startsWith('/mobile')) {
  await import('./mobile/main')
} else {
  window.location.replace('/mobile/')
}
