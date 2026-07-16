---
name: Lefax Academy System
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#46464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#77767e'
  outline-variant: '#c8c5ce'
  surface-tint: '#5a5c7e'
  primary: '#101230'
  on-primary: '#ffffff'
  primary-container: '#252746'
  on-primary-container: '#8d8eb3'
  inverse-primary: '#c3c3eb'
  secondary: '#785900'
  on-secondary: '#ffffff'
  secondary-container: '#fdc003'
  on-secondary-container: '#6c5000'
  tertiary: '#00123c'
  on-tertiary: '#ffffff'
  tertiary-container: '#002468'
  on-tertiary-container: '#5f8bff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e0e0ff'
  primary-fixed-dim: '#c3c3eb'
  on-primary-fixed: '#171937'
  on-primary-fixed-variant: '#424465'
  secondary-fixed: '#ffdf9e'
  secondary-fixed-dim: '#fabd00'
  on-secondary-fixed: '#261a00'
  on-secondary-fixed-variant: '#5b4300'
  tertiary-fixed: '#dbe1ff'
  tertiary-fixed-dim: '#b3c5ff'
  on-tertiary-fixed: '#00174a'
  on-tertiary-fixed-variant: '#003ea6'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  excellence-blue: '#252746'
  achievement-gold: '#FFC107'
  action-blue: '#0064FF'
  success-green: '#2E7D32'
  error-red: '#D32F2F'
  surface-gray: '#F3E9F7'
  text-primary: '#1F3545'
  text-secondary: '#64748B'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

The design system is engineered for high-stakes academic preparation, targeting Cameroonian students striving for admission into prestigious 'Grandes Écoles'. The brand personality is **authoritative, encouraging, and precision-oriented**. It balances the weight of academic excellence with the agility of modern mobile learning.

The chosen design style is **Corporate / Modern** with a strong emphasis on **Functional Minimalism**. This ensures the UI remains performant on mid-range Android devices and 2G/4G connections while maintaining a premium aesthetic. Key characteristics include:
- **High Legibility:** Generous whitespace and high-contrast typography to reduce cognitive load during intense study sessions.
- **Card-Based Architecture:** Information is modularized into discrete cards, facilitating a "micro-learning" flow.
- **Purposeful Color:** Color is used functionally to indicate progress, success, or urgency, rather than for decoration.
- **Reduced Complexity:** Elimination of heavy blurs, complex gradients, and high-fidelity animations to ensure low-latency interactions on varying hardware.

## Colors

The palette is anchored by **Excellence Blue**, a deep navy that conveys institutional trust and seriousness. This is contrasted by **Achievement Gold**, used exclusively for rewards (FaxCoins) and milestone celebrations to provide a sense of tangible value.

- **Primary (Excellence Blue):** Used for headers, primary actions, and brand-heavy components.
- **Secondary (Achievement Gold):** Reserved for motivational elements, coins, and premium indicators.
- **Tertiary (Action Blue):** A vibrant interactive blue for links and secondary buttons, derived from the brand's digital presence.
- **Neutral/Surface:** A strict diet of white and soft off-whites to maximize battery life and readability. 
- **Semantic Colors:** Green and Red are used with high saturation for immediate feedback in practice quizzes, ensuring students instantly recognize their performance status.

## Typography

The typography system prioritizes clarity and academic rigor. **Hanken Grotesk** is used for headlines to provide a sharp, modern, and professional edge. **Inter** is utilized for all body and UI text due to its exceptional legibility on small screens and diverse Android rendering engines.

- **Minimum Size:** Body text never drops below 14px to accommodate diverse mobile viewing conditions.
- **Contrast:** High-contrast ratios are maintained using `text-primary` (#1F3545) for all instructional content.
- **Hierarchy:** Bold weights are used sparingly for emphasis and navigation, ensuring the student's eye is drawn to the most critical learning material first.

## Layout & Spacing

This design system employs a **Fluid Grid** model optimized for mobile-first consumption. 

- **Grid:** A 4-column grid for mobile and an 8-column grid for tablets. 
- **Rhythm:** An 8px linear scale (4px, 8px, 16px, 24px, 32px) governs all padding and margins to ensure visual harmony.
- **Micro-learning Focus:** Vertical spacing between cards is kept consistent at 16px (`md`) to create a clear "stream" of learning tasks.
- **Constraints:** Maximum content width for tablet/desktop is capped at 720px to prevent long line lengths that hinder reading comprehension.

## Elevation & Depth

To maintain high performance on lower-end devices, the system uses **Tonal Layers** and **Low-Contrast Outlines** instead of heavy shadows.

- **Surface Levels:** 
    - **Level 0 (Background):** `neutral_color_hex` (#F8FAFC).
    - **Level 1 (Cards):** Pure White (#FFFFFF) with a thin 1px border (#E2E8F0).
    - **Level 2 (Active/Focus):** Pure White with a subtle, low-blur shadow (Y: 2px, Blur: 4px, Opacity: 0.05) to indicate interactivity.
- **Feedback Depth:** When a user selects a quiz answer, the card does not lift; instead, the border weight increases and changes color (Green or Red) to provide immediate, flat reinforcement.

## Shapes

The shape language is **Rounded**, reflecting a modern and accessible educational environment.

- **Cards & Containers:** 8px (`rounded-md`) corner radius provides a friendly yet structured appearance.
- **Buttons:** 8px radius to match cards, ensuring a cohesive UI language.
- **Progress Bars:** Fully rounded (pill) to represent the fluid nature of learning progress.
- **Icons:** Contained within 8px rounded squares or circles to denote category or status.

## Components

### Buttons
- **Primary:** Excellence Blue background with White text. Bold, 16px padding. Used for "Start Exam" or "Next Lesson".
- **Secondary:** Transparent with an Excellence Blue border.
- **Tertiary:** Text-only buttons for "Skip" or "Back" actions.

### Cards
- **Lesson Cards:** White background, 1px border, 16px internal padding. Includes a small icon representing the subject (Math, Physics, etc.).
- **Quiz Cards:** High-contrast borders that change to Success Green or Error Red upon interaction.

### Chips & Badges
- **Status Badges:** Used for difficulty levels (Easy, Medium, Hard) using soft tints of primary colors.
- **FaxCoin Chip:** Features the Achievement Gold color with a small coin icon, prominently displayed in the top navigation.

### Input Fields
- Understated design with a 1px border. Focus state uses a 2px Excellence Blue border. Labels always appear above the field for maximum clarity.

### Progress Indicators
- Horizontal bars using a light gray track and an Excellence Blue or Success Green fill. Always accompanied by a percentage label in `label-md` typography.

### Lists
- Clean, divider-based lists for syllabus navigation. Each item has a 48px minimum hit target to accommodate mobile thumb navigation.