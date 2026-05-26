import pytest
from playwright.sync_api import Page, expect

def test_services_page_localization(page: Page):
    # Check if home page loads first (sanity check)
    page.goto("http://localhost:3000/")
    page.wait_for_selector("h1")
    print("Home page loaded")

    # Navigate to Services page
    # Mock Supabase response to be empty to test static fallback localization
    page.route("**/rest/v1/services*", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body="[]"
    ))
    page.goto("http://localhost:3000/services")

    # Wait for page to load
    page.wait_for_selector("h1")

    # --- English Check ---
    # Check Header
    print("Checking English content...")
    # H1
    expect(page.get_by_role("heading", name="Professional Printing Services")).to_be_visible()
    # Hero Subtitle
    expect(page.get_by_text("Complete printing solutions for your business needs - from digital printing to illuminated signage", exact=True)).to_be_visible()
    # Section Title (H2)
    expect(page.get_by_role("heading", name="Our Services", exact=True)).to_be_visible()
    # Section Subtitle
    expect(page.get_by_text("Choose from our comprehensive range of printing services, each designed to meet specific business needs", exact=True)).to_be_visible()

    # Check Static Services (Fallback content)
    # We expect these to be visible if Supabase fails or if we are checking static content
    # Using text that matches the translation keys added
    # Increase timeout to allow for Supabase fallback or slow load
    expect(page.get_by_text("Digital Printing Services")).to_be_visible(timeout=15000)
    expect(page.get_by_text("High-quality standard format printing for all your business needs")).to_be_visible()
    
    expect(page.get_by_text("Large Format Printing")).to_be_visible()
    expect(page.get_by_text("Professional banners, posters, and specialty large-scale printing")).to_be_visible()

    # Check Benefits
    expect(page.get_by_text("Quality Guarantee")).to_be_visible()
    expect(page.get_by_text("Fast Turnaround")).to_be_visible()
    expect(page.get_by_text("Professional Service")).to_be_visible()

    # --- Switch to Spanish ---
    print("Switching to Spanish...")
    # Find the language switcher (globe icon)
    # Note: Using .first to avoid strict mode violation if multiple exist
    page.locator("svg.lucide-globe").first.click()
    page.get_by_text("Español").click()
    
    # Wait for language switch (content update)
    page.wait_for_timeout(1000)

    # --- Spanish Check ---
    print("Checking Spanish content...")
    
    # Check Header
    expect(page.get_by_role("heading", name="Servicios Profesionales de Impresión")).to_be_visible()
    expect(page.get_by_text("Soluciones completas de impresión para tu negocio: desde impresión digital hasta señalización iluminada", exact=True)).to_be_visible()

    # Check Static Services
    expect(page.get_by_text("Servicios de Impresión Digital")).to_be_visible()
    expect(page.get_by_text("Impresión de alta calidad en formato estándar para todas sus necesidades comerciales")).to_be_visible()
    
    expect(page.get_by_text("Impresión de Gran Formato")).to_be_visible()
    expect(page.get_by_text("Pancartas profesionales, carteles e impresión especializada a gran escala")).to_be_visible()

    # Check Benefits
    expect(page.get_by_text("Garantía de Calidad")).to_be_visible()
    expect(page.get_by_text("Entrega Rápida")).to_be_visible()
    expect(page.get_by_text("Servicio Profesional")).to_be_visible()

    print("Services page localization test passed!")
