import pytest
from playwright.sync_api import Page, expect

def test_product_catalog_localization(page: Page, base_url: str):
    """
    Test localization of the Product Catalog page (English and Spanish).
    Uses network interception to mock Supabase responses for deterministic testing.
    """
    
    # Mock data
    mock_products = [
        {
            "id": "1",
            "name": "Test Product 1",
            "description": "Test Description 1",
            "price": 29.99,
            "category": "T-Shirts",
            "image": "https://example.com/image1.jpg",
            "is_active": True,
            "is_featured": False,
            "is_customizable": True,
            "created_at": "2023-01-01T00:00:00Z"
        }
    ]
    
    mock_categories = [
        {
            "id": "1",
            "name": "T-Shirts",
            "slug": "t-shirts",
            "description": "Cotton T-Shirts",
            "is_active": True
        }
    ]

    # Intercept Supabase requests
    # Note: Adjust the URL pattern if the app uses a different Supabase URL
    # Assuming Supabase calls go to a URL containing "rest/v1"
    
    def handle_route(route):
        url = route.request.url
        if "products" in url and "select" in url:
             route.fulfill(status=200, content_type="application/json", body=str(mock_products).replace("'", '"').replace("True", "true").replace("False", "false"))
        elif "categories" in url and "select" in url:
             route.fulfill(status=200, content_type="application/json", body=str(mock_categories).replace("'", '"').replace("True", "true").replace("False", "false"))
        else:
            route.continue_()

    # Enable routing interception
    # Ideally we should know the exact endpoint. 
    # If the app uses local Supabase or remote, the domain might differ.
    # We'll use a wildcard pattern that should catch Supabase REST calls.
    page.route("**/rest/v1/**", handle_route)
    
    # --- English Check ---
    page.goto(f"{base_url}/products")
    
    # Ensure we are in English
    page.evaluate("localStorage.setItem('language', 'en')")
    page.reload()
    
    # Check Header Title & Description
    expect(page.get_by_role("heading", name="Product Catalog")).to_be_visible()
    expect(page.get_by_text("Browse our collection of customizable products")).to_be_visible()
    
    # Check Search Placeholder
    expect(page.get_by_placeholder("Search products...")).to_be_visible()
    
    # Check Categories Select Placeholder
    # SelectValue usually reflects the selected item or placeholder.
    # Initially "All Categories" is selected or placeholder "All Categories"
    # Based on code: <SelectValue placeholder={t("products.allCategories")} />
    # and <SelectItem value="all">{t("products.allCategories")}</SelectItem>
    expect(page.get_by_text("All Categories", exact=True).first).to_be_visible()

    
    # --- Spanish Check ---
    # Switch language using the UI (filter for visible button to avoid strict mode with mobile/desktop duplicates)
    page.locator("button:has(svg.lucide-globe) >> visible=true").click()
    page.get_by_role("menuitem", name="Español").click()
    
    # Wait for the title to change
    expect(page.get_by_role("heading", name="Catálogo de Productos")).to_be_visible()
    expect(page.get_by_text("Explora nuestra colección de productos personalizables")).to_be_visible()
    
    # Check Search Placeholder
    expect(page.get_by_placeholder("Buscar productos...")).to_be_visible()
    
    # Check Categories Select
    expect(page.get_by_text("Todas las categorías", exact=True).first).to_be_visible()
