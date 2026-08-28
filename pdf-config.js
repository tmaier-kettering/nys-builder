// PDF Export Formatting Configuration
// Edit this file to change how the exported PDF looks.
// All numeric size/position values are in PDF points (72pt = 1 inch).

window.PDF_CONFIG = {
  // ---- Page layout ----
  pageWidth: 612, // Full page width. 612 = US Letter width (8.5in * 72).
  pageHeight: 792, // Full page height. 792 = US Letter height (11in * 72).
  pageMargin: 40, // Left/right/top content margin from page edges.
  contentBottomMargin: 75, // Bottom boundary for content so footer area stays clear.

  // ---- Footer ----
  footerTextSize: 10, // Page number font size in the footer.
  footerLogoMaxWidth: 90, // Maximum rendered width for footer logo.
  footerLogoY: 18, // Y position (from page bottom) for footer logo.
  footerPageNumberY: 24, // Y position (from page bottom) for page number text.

  // ---- Table of contents ----
  tocTitleSize: 22, // Font size of the "Table of Contents" title.

  // ---- Legacy table row layout (currently unused in policy body) ----
  tableIndent: 36, // Left indent applied to old table-style rows.
  labelColumnWidth: 75, // Label column width in old table-style rows.
  tableColumnGap: 12, // Gap between label and value columns in old table rows.

  // ---- Policy block styling ----
  policyBlocks: {
    bandAColor: '#e3f1d6', // Background color for first/odd band within a section.
    bandBColor: '#98cd69', // Background color for second/even band within a section.
    bandInsetX: 6, // How far the band extends beyond text on left and right.
    bandWidthExtra: 12, // Extra total width added to band rectangle (usually 2 * bandInsetX).
    bandOffsetY: 0, // Vertical offset for band rectangle start (positive moves up).
    bandHeightExtra: 0, // Extra height added to band rectangle (positive makes band taller).
    commentaryTextColor: '#595959', // Text color for commentary lines.
    commentaryInset: 30, // Horizontal inset from policy text for commentary block.
    commentaryQuoteArea: 24, // Reserved width for opening quote glyph before commentary text.
    commentaryQuoteSize: 50, // Font size of the opening quote glyph.
    commentaryQuoteOffsetX: 5, // Horizontal nudge for opening quote position.
    commentaryQuoteOffsetY: -28 // Vertical nudge for opening quote position.
  },

  // ---- Brand colors (hex palette) ----
  colors: {
    forestGreen: '#356638', // Brand palette swatch: forest green.
    springGreen: '#98cd69', // Brand palette swatch: spring green.
    turquoise: '#3daa99', // Brand palette swatch: turquoise.
    marineBlue: '#142f5b', // Brand palette swatch: marine blue.
    unionRed: '#f30000', // Brand palette swatch: union red.
    black: '#000000', // Utility color: black.
    white: '#ffffff' // Utility color: white.
  },

  // ---- Color role mapping ----
  // Each value must match a key in the `colors` object above.
  palette: {
    heading: 'marineBlue', // Used for section headings, TOC text, and page numbers.
    body: 'black', // Used for primary policy text.
    accent: 'turquoise', // Used for accent lines/interactive emphasis in PDF styling.
    alert: 'unionRed' // Used for fallback warning/error text in generated PDF.
  },

  // ---- Typography scale ----
  typography: {
    lineHeightMultiplier: 1.15, // Line height = fontSize * this multiplier.
    paragraphSpacing: 6, // Vertical gap between text blocks.
    normal: { size: 11, style: 'regular' }, // Default body style.
    policy: { size: 12, style: 'regular' }, // Policy line style.
    title: { size: 24, style: 'black' }, // Title style.
    subtitle: { size: 14, style: 'light' }, // Subtitle style.
    heading1: { size: 20, style: 'extraBold' }, // Primary heading style.
    heading2: { size: 18, style: 'regular' }, // Section heading style.
    heading3: { size: 14, style: 'italic' } // Tertiary heading style.
  },

  // ---- Font assets ----
  // Each key is a style name referenced above in typography.*.style.
  fonts: {
    regular: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/montserrat/Montserrat-Regular.ttf', // Base regular font.
    light: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/montserrat/Montserrat-Light.ttf', // Light-weight font.
    italic: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/montserrat/Montserrat-Italic.ttf', // Italic font.
    extraBold: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/montserrat/Montserrat-ExtraBold.ttf', // Extra-bold font.
    black: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/montserrat/Montserrat-Black.ttf' // Heaviest weight font.
  }
};
