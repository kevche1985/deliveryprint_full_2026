"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel"
import { Package, ShoppingCart, Printer, FileText, PencilRuler, ShoppingBag, Truck } from "lucide-react"
import { getImageUrl } from "@/lib/image-utils"
import { type Product, getProducts } from "@/lib/database"
import { useCart } from "@/lib/cart-context"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/lib/language-context"
import { getTheme } from "@/lib/theme"
import PromoBanner from "@/components/promo-banner"
import { track } from "@/lib/analytics"
import { resolveMainBannerObjectFit, resolveMainBannerObjectPosition, type BannerObjectFit, type Breakpoint, type MainBannerConfig } from "@/lib/branding"

// Minimal product shape used for fallback/sample items alongside DB Products
type MinimalProduct = {
  id: string
  name: string
  description?: string
  price: number
  image?: string
}

export default function HomePage() {
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { addItem } = useCart()
  const router = useRouter()
  const { toast } = useToast()
  const { t } = useLanguage()
  const theme = getTheme()
  const [mainBanner, setMainBanner] = useState<MainBannerConfig | null>(null)
  const [heroHeight, setHeroHeight] = useState<number>(theme.bannerImageUrl ? 560 : 560)
  const [heroObjectPosition, setHeroObjectPosition] = useState<string>("50% 50%")
  const [heroObjectFit, setHeroObjectFit] = useState<BannerObjectFit>("cover")
  const [onboardingCarouselApi, setOnboardingCarouselApi] = useState<CarouselApi | null>(null)

  useEffect(() => {
    async function fetchCatalogProducts() {
      try {
        const products = await getProducts()
        setCatalogProducts(products)
        setFeaturedProducts(products.filter((p) => p.is_featured).slice(0, 6))
      } catch (err) {
        console.error("Error fetching featured products:", err)
        setError(t("home.errors.failedToLoadFeatured"))
      } finally {
        setLoading(false)
      }
    }
    fetchCatalogProducts()
  }, [])

  useEffect(() => {
    if (!onboardingCarouselApi) return
    const id = window.setInterval(() => {
      onboardingCarouselApi.scrollNext()
    }, 3000)
    return () => window.clearInterval(id)
  }, [onboardingCarouselApi])

  useEffect(() => {
    let cancelled = false
    fetch("/api/branding/main-banner")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        if (json?.banner) setMainBanner(json.banner)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function compute() {
      const w = typeof window !== "undefined" ? window.innerWidth : 1280
      const b = mainBanner
      const bp: Breakpoint = w < 768 ? "mobile" : w < 1280 ? "tablet" : "desktop"
      if (!b) {
        setHeroHeight(560)
        setHeroObjectFit("cover")
        setHeroObjectPosition("50% 50%")
        return
      }
      const h = b.heights[bp]
      setHeroHeight(h)
      setHeroObjectFit(resolveMainBannerObjectFit(b, bp))
      setHeroObjectPosition(resolveMainBannerObjectPosition(b, bp))
    }
    compute()
    window.addEventListener("resize", compute)
    return () => window.removeEventListener("resize", compute)
  }, [mainBanner])

  const heroImageUrl = mainBanner?.imageUrl || theme.bannerImageUrl

  const handleAddToCartAndCheckout = (product: Product | MinimalProduct) => {
    if ("is_quotable" in product && !!(product as any).is_quotable) {
      router.push(`/quote?productId=${product.id}`)
      return
    }
    track("add_to_cart", { productId: product.id, price: product.price })
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: (product as any).image || "/placeholder.svg",
      customizations: {}, // No customizations for direct product add
      // No design associated when adding directly from home page
      designId: undefined,
    })
    toast({
      title: t("common.toast.addedToCartTitle"),
      description: `${product.name} ${t("common.toast.addedToCartDescSuffix")}`,
    })
    router.push("/checkout")
  }

  const sampleProducts = [
    {
      id: "sample-1",
      name: "Custom T-Shirt",
      description: "Design your own unique T-shirt.",
      price: 25.0,
      image: "/placeholder.svg?height=300&width=400",
    },
    {
      id: "sample-2",
      name: "Mug Printing",
      description: "Personalized mugs for any occasion.",
      price: 15.0,
      image: "/placeholder.svg?height=300&width=400",
    },
    {
      id: "sample-3",
      name: "Poster Design",
      description: "High-quality custom posters.",
      price: 30.0,
      image: "/placeholder.svg?height=300&width=400",
    },
    {
      id: "sample-4",
      name: "Business Cards",
      description: "Professional business card printing.",
      price: 20.0,
      image: "/placeholder.svg?height=300&width=400",
    },
  ]

  const onboardingProducts = useMemo(() => {
    return catalogProducts.length > 0 ? catalogProducts : sampleProducts
  }, [catalogProducts])

  return (
    <main className="flex-1">
      <PromoBanner />
      <section
        className="w-full overflow-hidden"
        style={{ height: heroHeight }}
      >
        <img
          src={heroImageUrl}
          alt="Main banner"
          className="w-full h-full"
          style={{ objectFit: heroObjectFit, objectPosition: heroObjectPosition }}
        />
      </section>

      {/* Removed promotional strip for Digital Printing */}

      {/* El Camino a la Perfección */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <h2 className="text-2xl md:text-3xl font-bold">El Camino a la Perfección</h2>
            <div className="w-16 h-1 bg-red-600 rounded mt-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {([
              {
                title: "Selecciona tu Producto",
                desc: "Explora nuestro catálogo curado de materiales y formatos premium.",
                icon: Package,
                tile: "bg-red-50",
                iconColor: "text-red-600",
              },
              {
                title: "Personaliza tu Diseño",
                desc: "Sube tus archivos y utiliza nuestro editor creativo con IA integrada.",
                icon: PencilRuler,
                tile: "bg-red-50",
                iconColor: "text-red-600",
              },
              {
                title: "Solicita tu Servicio",
                desc: "Configura los detalles técnicos y confirma tu pedido con un clic.",
                icon: ShoppingBag,
                tile: "bg-red-50",
                iconColor: "text-red-600",
              },
              {
                title: "Recibe tu Pedido",
                desc: "Logística de precisión que garantiza que tu pedido llegue impecable.",
                icon: Truck,
                tile: "bg-emerald-50",
                iconColor: "text-emerald-600",
              },
            ] as Array<any>).map((s, i) => {
              const Icon = s.icon
              return (
                <div key={i} className="relative rounded-xl bg-white shadow-editorial p-6 border border-gray-100">
                  <div className={`w-10 h-10 rounded-md ${s.tile} flex items-center justify-center mb-4`}>
                    <Icon className={`w-5 h-5 ${s.iconColor}`} />
                  </div>
                  <h3 className="font-semibold mb-1">{s.title}</h3>
                  <p className="text-sm text-gray-600">{s.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex items-baseline justify-between mb-8">
            <h2 className="text-3xl font-bold">Servicios Especializados</h2>
            <Link href="/services" className="text-red-600 text-sm">Ver todos los servicios →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Large Format (left) */}
            <Card className="text-center transition-transform duration-200 hover:scale-[1.03] hover:shadow-lg">
              <CardHeader>
                <Package className="h-12 w-12 text-red-600 mx-auto mb-4" />
                <CardTitle>{t("services.largeFormat")}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{t("services.largeFormatDesc")}</CardDescription>
              </CardContent>
              <CardFooter>
                <Link href="/services/large-format" className="w-full">
                  <Button variant="outline" className="w-full bg-transparent">
                    {t("common.learnMore")}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
            {/* Digital Printing (middle, emphasized) */}
            <Card className="text-center transition-transform duration-200 hover:scale-[1.06] hover:shadow-xl hover:ring-2 hover:ring-red-500 border border-red-100">
              <CardHeader>
                <Printer className="h-12 w-12 text-red-600 mx-auto mb-4" />
                <CardTitle>{t("services.digitalPrinting")}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{t("services.digitalPrintingDesc")}</CardDescription>
              </CardContent>
              <CardFooter>
                <Link href="/services/digital-printing" className="w-full">
                  <Button variant="outline" className="w-full bg-transparent text-red-700 border-red-300 hover:bg-red-50">
                    {t("common.learnMore")}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
            {/* Design Studio (right) */}
            <Card className="text-center transition-transform duration-200 hover:scale-[1.03] hover:shadow-lg">
              <CardHeader>
                <FileText className="h-12 w-12 text-red-600 mx-auto mb-4" />
                <CardTitle>{t("services.designStudio")}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{t("services.designStudioDesc")}</CardDescription>
              </CardContent>
              <CardFooter>
                <Link href="/ai-studio" className="w-full">
                  <Button variant="outline" className="w-full bg-transparent">
                    {t("common.startDesigning")}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* Removed interactive Purchase Roadmap section */}

      {/* Primeros Pasos */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="rounded-2xl overflow-hidden shadow-editorial">
            <Carousel
              setApi={setOnboardingCarouselApi}
              opts={{ loop: true, align: "start" }}
              className="w-full"
            >
              <CarouselContent className="-ml-0">
                {onboardingProducts.map((product) => (
                  <CarouselItem key={product.id} className="pl-0">
                    <div className="relative w-full h-[540px] bg-gray-100">
                      {product.image ? (
                        <img
                          src={getImageUrl(product.image as any)}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-12 w-12 text-gray-400" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                      <div className="absolute left-6 right-6 bottom-6">
                        <div className="text-white text-2xl font-semibold drop-shadow-sm">{product.name}</div>
                        {"price" in product && typeof (product as any).price === "number" && !("is_quotable" in product && !!(product as any).is_quotable) && (
                          <div className="mt-1 text-white/90 text-sm drop-shadow-sm">${(product as any).price.toFixed(2)}</div>
                        )}
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
          <div>
            <div className="text-xs tracking-[0.2em] text-emerald-700 mb-2">PRIMEROS PASOS</div>
            <h3 className="text-3xl font-bold mb-6">Cómo realizar tu primera compra</h3>
            <ul className="space-y-4 mb-6">
              <li>
                <div className="font-semibold">Crea tu cuenta</div>
                <p className="text-sm text-gray-600">Regístrate en segundos para acceder a precios exclusivos y gestión de pedidos.</p>
              </li>
              <li>
                <div className="font-semibold">Sube y Configura</div>
                <p className="text-sm text-gray-600">Carga tus archivos y define los valores para asegurar que lo que pides sea lo que recibes.</p>
              </li>
              <li>
                <div className="font-semibold">Checkout Seguro</div>
                <p className="text-sm text-gray-600">Procesamos tu pago y registramos tu pedido. ¡Nosotros hacemos el resto!</p>
              </li>
            </ul>
            <Link href="/products" className="inline-block">
              <Button className="bg-red-600 hover:bg-red-700 text-white">Empezar ahora</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">{t("home.featuredProductsTitle")}</h2>

          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="animate-pulse">
                  <div className="w-full h-[300px] bg-gray-200 rounded-t-lg flex items-center justify-center">
                    <Package className="h-12 w-12 text-gray-400" />
                  </div>
                  <CardContent className="p-4">
                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </CardContent>
                  <CardFooter className="flex justify-between items-center p-4">
                    <div className="h-6 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-10 bg-gray-200 rounded w-1/3"></div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          {error && (
            <div className="text-center text-red-500 py-8">
              <p>{error}</p>
              <p>{t("home.errors.displayingSample")}</p>
            </div>
          )}

          {!loading && featuredProducts.length === 0 && !error && (
            <div className="text-center text-gray-500 py-8">
              <p>{t("home.noFeatured")}</p>
            </div>
          )}

          {!loading && (featuredProducts.length > 0 || error) && (
            <Carousel
              opts={{
                align: "start",
              }}
              className="w-full"
            >
              <CarouselContent className="-ml-4">
                {(featuredProducts.length > 0 ? featuredProducts : sampleProducts).map((product) => (
                  <CarouselItem key={product.id} className="pl-4 md:basis-1/2 lg:basis-1/3">
                    <Card className="overflow-hidden">
                      <div className="relative w-full h-[300px] bg-gray-100 flex items-center justify-center">
                        {product.image ? (
                          <img
                            src={getImageUrl(product.image as any)}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="h-12 w-12 text-gray-400" />
                        )}
                      </div>
                      <CardContent className="p-4">
                        <CardTitle className="text-xl font-semibold mb-2">{product.name}</CardTitle>
                        <CardDescription className="text-gray-600 line-clamp-2">
                          {product.description || t("home.noDescription")}
                        </CardDescription>
                      </CardContent>
                      <CardFooter className="flex justify-between items-center p-4 pt-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-gray-500">{t("products.fromLabel")}</span>
                          <span className="text-2xl font-bold text-red-600">${product.price.toFixed(2)}</span>
                        </div>
                        <Button onClick={() => handleAddToCartAndCheckout(product)}>
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          {t("common.addToCart")}
                        </Button>
                      </CardFooter>
                    </Card>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          )}
        </div>
      </section>

      {/* Call to Action */}
      <section className="text-white py-16 text-center" style={{ backgroundColor: theme.primaryColor }}>
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold mb-4">{t("home.ctaTitle")}</h2>
          <p className="text-xl mb-8">
            {t("home.ctaSubtitle")}
          </p>
          <div className="flex justify-center space-x-4">
            <Link href="/ai-studio" passHref>
            <Button size="lg" className="bg-white shadow-lg" style={{ color: theme.primaryColor }}>
              {t("common.startDesigning")}
            </Button>
          </Link>
            <Link href="/quote" passHref>
              <Button size="lg" variant="outline" className="border-white text-white shadow-lg bg-transparent" style={{}}>
                {t("home.ctaGetQuote")}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
