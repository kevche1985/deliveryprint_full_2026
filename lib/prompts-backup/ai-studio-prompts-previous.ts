export const PREV_API_ENHANCED_PROMPTS = {
  logo: (prompt: string) => `Create a professional logo design: ${prompt}. The logo should be clean, memorable, and work well at different sizes. Use a transparent or white background.`,
  image: (prompt: string) => `Create a high-quality image: ${prompt}. The image should be detailed, visually appealing, and suitable for printing.`,
  font: (prompt: string) => `Create a custom typography design for the text: ${prompt}. The font should be unique, readable, and reflect the character of the text.`,
}

export const PREV_OPENAI_PROMPTS = {
  logo: (businessName: string, industry: string, style?: string, colors?: string, slogan?: string) => `Create a professional logo for "${businessName}", a ${industry} company. ${slogan ? `Company slogan: "${slogan}". ` : ""}${style ? `Style: ${style}. ` : "Style: modern and professional. "}${colors ? `Colors: ${colors}. ` : "Use appropriate brand colors. "}The logo should be clean, memorable, work well at different sizes, and have a transparent or white background.`,
  image: (description: string, style?: string) => `Create a high-quality image for printing: ${description}. ${style ? `Style: ${style}. ` : "Style: professional and print-ready. "}The image should be detailed, visually appealing, and suitable for high-resolution printing.`,
  font: (text: string, style?: string) => `Create a custom typography design for the text: "${text}". ${style ? `Style: ${style}. ` : "Style: unique and readable. "}The design should be creative, readable, reflect the character of the text, and work well for printing.`,
}

export const PREV_PAGE_COMPOSED_FIELDS = {
  image: ["image_description", "category", "style", "color_scheme"],
  logo: ["logo_description", "industry", "style", "color_preference"],
  font: ["font_description", "font_category", "style", "weight", "sample_text"],
}
