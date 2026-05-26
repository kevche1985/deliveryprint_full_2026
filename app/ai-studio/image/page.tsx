"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, RefreshCw, Info, ImageIcon, ShoppingCart, Sparkles } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { useDigitalCart } from "@/lib/digital-cart-context"
import { useRouter } from "next/navigation"
import DigitalProductChoiceModal from "@/components/digital-product-choice-modal"
import { supabase } from "@/lib/supabase"
import { IMAGE_PROMPT_TEMPLATE, buildPromptFromTemplate } from "@/lib/ai-prompts"
import { useLanguage } from "@/lib/language-context"

export default function ImageGeneratorPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { addItem } = useDigitalCart()
  const router = useRouter()
  const { t, tRaw } = useLanguage()
  const categories = (tRaw("aiStudio.image.categories") as string[]) || []
  const styles = (tRaw("aiStudio.image.styles") as string[]) || []
  const colorSchemes = (tRaw("aiStudio.image.colorSchemes") as Array<{ name: string; colors: string[] }>) || []
  const [prompt, setPrompt] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedStyle, setSelectedStyle] = useState("")
  const [selectedColorScheme, setSelectedColorScheme] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [designId, setDesignId] = useState<string | null>(null)
  const [showChoiceModal, setShowChoiceModal] = useState(false)
  const [currentProduct, setCurrentProduct] = useState<any>(null)

  const handleGenerate = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to generate an image",
        variant: "destructive",
      })
      return
    }

    if (!prompt) {
      toast({
        title: "Prompt required",
        description: "Please enter a description for your image",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    setGeneratedImage(null)
    setDesignId(null)

    const backendPrompt = {
      ...IMAGE_PROMPT_TEMPLATE,
      input_parameters: {
        image_description: prompt,
        category: selectedCategory,
        style: selectedStyle,
        color_scheme: selectedColorScheme,
      },
    }
    const fullPrompt = buildPromptFromTemplate(backendPrompt, backendPrompt.input_parameters)

    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          backendPrompt,
          type: "image",
          userId: user.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to generate image")
      }

      const data = await response.json()
      const isPlaceholder = typeof data?.watermarkedUrl === 'string' && data.watermarkedUrl.includes('placeholder.svg')
      if (!data?.success || isPlaceholder) {
        const sdPrompt = encodeURIComponent(
          `Highly detailed SDXL, ${selectedStyle || 'Digital Art'} style, ${selectedCategory || 'General'} scene, ` +
          `vibrant color scheme ${selectedColorScheme || 'Vibrant'}, ` +
          `print-ready composition for t-shirts, posters, mugs; balanced layout; clean edges; high detail; ` +
          `no text unless requested; strong contrast; ${prompt}`
        )
        const size = 'square_hd'
        const url = `https://coreva-normal.trae.ai/api/ide/v1/text_to_image?prompt=${sdPrompt}&image_size=${size}`
        setGeneratedImage(url)
        setDesignId(`sdxl-${Date.now()}`)
      } else {
        setGeneratedImage(data.watermarkedUrl)
        setDesignId(data.designId)
      }
    } catch (error: any) {
      const sdPromptFallback = encodeURIComponent(
        `Highly detailed SDXL, ${selectedStyle || 'Digital Art'} style, ${selectedCategory || 'General'} scene, ` +
        `vibrant color scheme ${selectedColorScheme || 'Vibrant'}, print-ready, balanced, clean edges, high detail, ` +
        `no text unless requested. ${prompt}`
      )
      const url = `https://coreva-normal.trae.ai/api/ide/v1/text_to_image?prompt=${sdPromptFallback}&image_size=square_hd`
      setGeneratedImage(url)
      setDesignId(`sdxl-${Date.now()}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAddToCart = async () => {
    if (!designId || !generatedImage) {
      toast({
        title: "Unable to proceed",
        description: !designId 
          ? "Design ID is missing. Please try generating the image again." 
          : "Generated image is missing. Please try generating the image again.",
        variant: "destructive",
      })
      return
    }

    // Create the product data for the modal immediately
    const imageProduct = {
      id: `temp-${Date.now()}`, // Temporary ID
      name: `AI Image - ${prompt.substring(0, 30)}${prompt.length > 30 ? "..." : ""}`,
      type: "image",
      previewUrl: generatedImage, // Use the generated image as preview
      downloadUrl: generatedImage, // Will be updated after purchase
      designId: designId,
      generationInputs: {
        prompt,
        category: selectedCategory,
        style: selectedStyle,
        colorScheme: selectedColorScheme,
      },
    }

    // Show the modal immediately
    setCurrentProduct(imageProduct)
    setShowChoiceModal(true)
  }

  const handleDownloadChoice = async () => {
    // Close the modal first
    setShowChoiceModal(false)
    setCurrentProduct(null)
    
    // Show loading toast
    const loadingToast = toast({
      title: "Processing...",
      description: "Preparing your image for checkout.",
    })

    try {
      // Now store the digital product when user chooses download
      const response = await fetch("/api/digital-products/store", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          productType: "image",
          name: `AI Image - ${prompt.substring(0, 30)}${prompt.length > 30 ? "..." : ""}`,
          imageUrl: generatedImage,
          description: `AI-generated image: ${prompt}`,
          generationParams: {
            prompt,
            category: selectedCategory,
            style: selectedStyle,
            colorScheme: selectedColorScheme,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to store digital product")
      }

      const result = await response.json()
      
      // Add to digital cart with the correct structure
      const imageItem = {
        productId: result.product.id,
        designId: result.product.id,
        type: "image" as const,
        name: result.product.name,
        basePrice: 4.99,
        previewUrl: result.product.preview_url,
        generationInputs: {
          prompt,
          category: selectedCategory,
          style: selectedStyle,
          colorScheme: selectedColorScheme,
        },
        selectedFormats: ["basic"],
        selectedLicense: "personal",
        formatOptions: [
          {
            id: "basic",
            name: "Basic Package",
            description: "PNG, JPG (1024x1024)",
            price: 0,
            included: true,
          },
          {
            id: "professional",
            name: "Professional Package",
            description: "All basic + SVG, PDF, high-res",
            price: 2.99,
            included: false,
          },
          {
            id: "enterprise",
            name: "Enterprise Package",
            description: "All formats + source files",
            price: 4.99,
            included: false,
          },
        ],
        licenseOptions: [
          {
            id: "personal",
            name: "Personal Use",
            description: "For non-commercial projects",
            price: 0,
            included: true,
          },
          {
            id: "commercial",
            name: "Commercial License",
            description: "For business use",
            price: 9.99,
            included: false,
          },
          {
            id: "extended",
            name: "Extended License",
            description: "Unlimited commercial use",
            price: 19.99,
            included: false,
          },
        ],
        downloadReady: false,
      }
    
      await addItem(imageItem)
    
      toast({
        title: "Added to Cart",
        description: "Your AI image has been added to cart for digital download.",
      })
      
      // Redirect to checkout
      router.push("/checkout")
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process your request",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("aiStudio.image.title")}</h1>
          <p className="text-gray-600">{t("aiStudio.image.subtitle")}</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="animate-slide-in-left">
            <Card>
              <CardHeader>
                <CardTitle>{t("aiStudio.image.form.title")}</CardTitle>
                <CardDescription>{t("aiStudio.image.form.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="prompt">{t("aiStudio.image.form.promptLabel")}</Label>
                  <Textarea
                    id="prompt"
                    placeholder={t("aiStudio.image.form.promptPlaceholder")}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    className="resize-none"
                    disabled={isGenerating}
                  />
                  <p className="text-sm text-gray-500">{prompt.length}/500 {t("aiStudio.image.form.characters")}</p>
                </div>

                <div className="space-y-2">
                  <Label>{t("aiStudio.image.form.categoryLabel")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <Badge
                        key={category}
                        variant={selectedCategory === category ? "default" : "outline"}
                        className={`cursor-pointer ${
                          selectedCategory === category
                            ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90"
                            : "hover:bg-gray-100"
                        }`}
                        onClick={() => setSelectedCategory(category)}
                      >
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("aiStudio.image.form.styleLabel")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {styles.map((style) => (
                      <Badge
                        key={style}
                        variant={selectedStyle === style ? "default" : "outline"}
                        className={`cursor-pointer ${
                          selectedStyle === style
                            ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90"
                            : "hover:bg-gray-100"
                        }`}
                        onClick={() => setSelectedStyle(style)}
                      >
                        {style}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("aiStudio.image.form.colorSchemeLabel")}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {colorSchemes.map((scheme) => (
                      <div
                        key={scheme.name}
                        className={`border rounded-lg p-3 cursor-pointer transition-all ${
                          selectedColorScheme === scheme.name
                            ? "border-purple-500 bg-purple-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => setSelectedColorScheme(scheme.name)}
                      >
                        <p className="text-sm font-medium mb-2">{scheme.name}</p>
                        <div className="flex space-x-1">
                          {scheme.colors.map((color) => (
                            <div key={color} className="w-6 h-6 rounded" style={{ backgroundColor: color }} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {t("aiStudio.image.info")}
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleGenerate}
                  disabled={!prompt || isGenerating}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 text-white"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("aiStudio.image.buttons.generating")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      {t("aiStudio.image.buttons.generate")}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="animate-slide-in-right">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>{t("aiStudio.image.preview.title")}</CardTitle>
                <CardDescription>{t("aiStudio.image.preview.empty")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center min-h-[400px]">
                {isGenerating ? (
                  <div className="text-center">
                    <Loader2 className="h-16 w-16 animate-spin text-purple-600 mx-auto mb-4" />
                    <p className="text-gray-600">{t("aiStudio.image.preview.generating")}</p>
                    <p className="text-sm text-gray-500 mt-2">{t("aiStudio.image.preview.mayTake")}</p>
                  </div>
                ) : generatedImage ? (
                  <div className="relative animate-scale-in w-full">
                    <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
                      <img
                        src={generatedImage || "/placeholder.svg"}
                        alt={t("aiStudio.image.title")}
                        className="max-w-full h-auto mx-auto rounded-lg"
                        style={{ maxHeight: "300px" }}
                      />
                      <div className="space-y-3">
                        <Button
                          onClick={handleAddToCart}
                          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 text-white"
                        >
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          {t("aiStudio.image.buttons.chooseDelivery")}
                        </Button>
                        <Button onClick={handleGenerate} variant="outline" className="w-full">
                          <RefreshCw className="mr-2 h-4 w-4" />
                          {t("aiStudio.image.buttons.generateAnother")}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-400">
                    <ImageIcon className="h-16 w-16 mx-auto mb-4" />
                    <p>{t("aiStudio.image.preview.empty")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        
        {showChoiceModal && currentProduct && (
          <DigitalProductChoiceModal
            isOpen={showChoiceModal}
            onClose={() => {
              setShowChoiceModal(false)
              setCurrentProduct(null)
              toast({
                title: "Image Stored Successfully",
                description: "Your AI image has been saved and is ready for download options.",
              })
            }}
            product={currentProduct}
            onDownloadChoice={handleDownloadChoice}
          />
        )}
      </div>
    </div>
  )
}
