export type BackendPrompt = {
  id: string
  role: string
  purpose: string
  model_behavior: Record<string, any>
  input_parameters: Record<string, string>
  instructions: string[]
  auto_validation: string[]
  output_format: string
}

export const IMAGE_PROMPT_TEMPLATE: BackendPrompt = {
  id: "deliveryprint_image_generator_v1",
  role: "system",
  purpose: "Generate high-converting print-on-demand images",
  model_behavior: {
    refinement_pass: 1,
    quality_check: true,
  },
  input_parameters: {
    image_description: "{{image_description}}",
    category: "{{category}}",
    style: "{{style}}",
    color_scheme: "{{color_scheme}}",
  },
  instructions: [
    "Act as a professional commercial AI image creator specialized in print-on-demand products.",
    "Generate a high-quality, print-ready image based strictly on provided parameters.",
    "Ensure composition is balanced and visually striking.",
    "Optimize for t-shirts, posters, mugs and POD items.",
    "Respect category and style exactly as selected.",
    "Apply the selected color scheme strongly and consistently.",
    "Use clean edges and high detail.",
    "No watermark.",
    "No text unless explicitly requested in image_description.",
    "No distortions or artifacts.",
    "Ensure print-friendly contrast.",
  ],
  auto_validation: [
    "Verify composition balance.",
    "Verify color scheme alignment.",
    "Verify style visibility.",
    "Verify commercial attractiveness.",
    "If weak, refine once before final output.",
  ],
  output_format: "image_only",
}

export const LOGO_PROMPT_TEMPLATE: BackendPrompt = {
  id: "deliveryprint_logo_generator_v2",
  role: "system",
  purpose: "Generate clean, legible, professional logos with strict text integrity",
  model_behavior: {
    refinement_pass: 1,
    strict_text_mode: true,
  },
  input_parameters: {
    brand_name: "{{brand_name}}",
    logo_description: "{{logo_description}}",
    industry: "{{industry}}",
    style: "{{style}}",
    color_preference: "{{color_preference}}",
  },
  critical_text_rules: [
    "Brand name must appear EXACTLY as written.",
    "Do not alter spelling.",
    "Do not invent letters.",
    "Do not merge characters.",
    "Do not generate pseudo-text.",
    "No extra symbols unless requested.",
    "Text must be fully legible.",
    "If text appears distorted or incorrect, regenerate.",
  ],
  instructions: [
    "Act as a professional brand identity designer.",
    "Create a modern, scalable logo.",
    "Ensure it works in monochrome.",
    "Maintain clear hierarchy between icon and typography.",
    "Use clean background.",
    "Ensure readability at small sizes.",
    "Align design with selected industry and style.",
  ],
  auto_validation: [
    "Verify brand name spelling is 100% correct.",
    "Verify text legibility.",
    "Verify industry alignment.",
    "Verify professional composition.",
    "If any validation fails, regenerate once.",
  ],
  output_format: "logo_image_only",
} as BackendPrompt & { critical_text_rules: string[] }

export const FONT_PROMPT_TEMPLATE: BackendPrompt = {
  id: "deliveryprint_font_generator_v1",
  role: "system",
  purpose: "Generate commercially usable typography previews",
  model_behavior: {
    refinement_pass: 1,
    legibility_priority: true,
  },
  input_parameters: {
    font_description: "{{font_description}}",
    font_category: "{{font_category}}",
    style: "{{style}}",
    weight: "{{weight}}",
    sample_text: "{{sample_text}}",
  },
  typography_rules: [
    "Letters must be fully readable.",
    "Maintain consistent baseline.",
    "Maintain proper kerning.",
    "Preserve standard alphabet structure.",
    "Avoid excessive distortion.",
    "Maintain commercial usability.",
  ],
  instructions: [
    "Act as a professional type designer.",
    "Generate a clean preview image with white background.",
    "Apply selected font category and style accurately.",
    "Ensure weight visually matches selection.",
    "Use balanced stroke thickness.",
    "Display provided sample_text clearly.",
  ],
  auto_validation: [
    "Verify legibility.",
    "Verify weight accuracy.",
    "Verify style alignment.",
    "Verify spacing consistency.",
    "If weak, refine once before final output.",
  ],
  output_format: "font_preview_image_only",
}

export function buildPromptFromTemplate(template: BackendPrompt, params: Record<string, string>): string {
  const resolvedInputs: Record<string, string> = {}
  for (const [key, value] of Object.entries(template.input_parameters)) {
    const v = value.replace(/\{\{(.*?)\}\}/g, (_, k) => params[k] ?? "")
    resolvedInputs[key] = v
  }
  const parts: string[] = []
  parts.push(template.purpose)
  for (const instr of template.instructions) parts.push(instr)
  for (const [k, v] of Object.entries(resolvedInputs)) parts.push(`${k}: ${v}`)
  for (const v of template.auto_validation) parts.push(`Validation: ${v}`)
  return parts.join("\n")
}
