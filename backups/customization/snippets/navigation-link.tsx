// Add this inside your Admin dropdown/menu
<DropdownMenuItem asChild>
  <Link href="/admin/customization">Web Customizer</Link>
</DropdownMenuItem>

// For mobile admin list
<Link
  href="/admin/customization"
  className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
  onClick={() => setMobileMenuOpen(false)}
>
  Web Customizer
</Link>

