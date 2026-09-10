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
  // All measured directly from the source Canva PDF's baked-in footer (preface/overview/preamble
  // pages) so the dynamically-drawn footer (TOC, content pages) matches it exactly — these same
  // footerPageNumber*/footerTextSize values are also reused to overlay the number on chapter-cover
  // pages, since that's the identical design element, just baked vs. drawn.
  footerTextSize: 16, // Page number font size in the footer (Antonio Bold, matches the source).
  footerLogoMaxWidth: 159, // Rendered width for footer logo (source logo image frame is 159x119.25pt).
  footerLogoY: -28, // Y position (from page bottom) for footer logo — the source bleeds slightly below the page edge.
  footerLogoX: 57, // X position (from page left) for footer logo.
  footerPageNumberY: 22, // Y position (from page bottom) for page number text.
  footerPageNumberX: 29, // X position (from page left) for the page number, left of the logo.
  footerBarHeight: 65, // Visible height of the gradient footer bar (source image bleeds further below the page edge).
  footerDividerGap: 24, // Horizontal gap between the logo's right edge and the start of the footer divider line.
  footerDividerThickness: 5.25, // Stroke thickness of the footer divider line.
  footerDividerY: 32, // Y position (from page bottom) for the footer divider line.

  // ---- Table of contents ----
  tocTitleSize: 22, // Font size of the "Table of Contents" title.
  tocEntrySize: 12, // Font size of TOC entry lines.
  tocSubEntryIndent: 16, // Left indent for chapter subgroup entries (e.g. "International - Mitigation").
  tocDotLeaderGap: 4, // Horizontal gap between entry text/dots and dots/page number.

  // ---- Legacy table row layout (currently unused in policy body) ----
  tableIndent: 36, // Left indent applied to old table-style rows.
  labelColumnWidth: 75, // Label column width in old table-style rows.
  tableColumnGap: 12, // Gap between label and value columns in old table rows.

  // ---- Policy block styling ----
  policyBlocks: {
    bandAColor: '#e2f5f2', // Background color for first/odd band within a section (light teal tint).
    bandBColor: '#a9e0a0', // Background color for second/even band within a section (light green tint).
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
  // Replaced by the 2026 Canva redesign — teal/green gradient palette, not a reuse of the old swatches below.
  colors: {
    teal: '#089bab', // Brand gradient stop A: teal (also solid heading color).
    green: '#7dd958', // Brand gradient stop B: green.
    forestGreen: '#356638', // Legacy palette swatch, kept in case older material still references it.
    springGreen: '#98cd69', // Legacy palette swatch: spring green.
    turquoise: '#3daa99', // Legacy palette swatch: turquoise.
    marineBlue: '#142f5b', // Legacy palette swatch: marine blue.
    unionRed: '#f30000', // Legacy palette swatch: union red.
    black: '#000000', // Utility color: black.
    white: '#ffffff' // Utility color: white.
  },

  // ---- Color role mapping ----
  // Each value must match a key in the `colors` object above.
  palette: {
    heading: 'teal', // Used for section headings, TOC entries, and page numbers.
    body: 'black', // Used for primary policy text.
    accent: 'green', // Used for accent lines/interactive emphasis in PDF styling.
    alert: 'unionRed' // Used for fallback warning/error text in generated PDF.
  },

  // ---- Typography scale ----
  typography: {
    lineHeightMultiplier: 1.15, // Line height = fontSize * this multiplier.
    paragraphSpacing: 6, // Vertical gap between text blocks.
    normal: { size: 11, style: 'regular' }, // Default body style (Montserrat).
    policy: { size: 12, style: 'regular' }, // Policy line style (Montserrat).
    title: { size: 24, style: 'antonioBold' }, // Title style (Antonio).
    subtitle: { size: 14, style: 'light' }, // Subtitle style (Montserrat).
    heading1: { size: 20, style: 'antonioBold' }, // Primary heading style (Antonio).
    heading2: { size: 18, style: 'antonioBold' }, // Section heading style (Antonio).
    heading3: { size: 14, style: 'antonioRegular' } // Tertiary heading style (Antonio).
  },

  // ---- Font assets ----
  // Each key is a style name referenced above in typography.*.style.
  // Self-hosted, not CDN-fetched: Google Fonts now ships both Montserrat and Antonio only as
  // variable fonts (no static per-weight .ttf), which broke the old google/fonts@main .ttf URLs
  // (all 404 now), and a jsdelivr mirror's .woff files embed into the PDF as raw WOFF bytes —
  // not valid PDF FontFile data, so some PDF renderers fail to read them. These are real static
  // TTF instances (via fonttools' variable-font instancer, see assets/fonts/), committed locally
  // so this doesn't break again if an upstream mirror reshuffles its file layout.
  fonts: {
    regular: './assets/fonts/Montserrat-Regular.ttf', // Base regular font.
    light: './assets/fonts/Montserrat-Light.ttf', // Light-weight font.
    italic: './assets/fonts/Montserrat-Italic.ttf', // Italic font.
    extraBold: './assets/fonts/Montserrat-ExtraBold.ttf', // Extra-bold font.
    black: './assets/fonts/Montserrat-Black.ttf', // Heaviest weight font.
    antonioBold: './assets/fonts/Antonio-Bold.ttf',
    antonioRegular: './assets/fonts/Antonio-Regular.ttf'
  }
};
