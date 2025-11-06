# Conditional Documentation Guide

This prompt helps you determine what documentation you should read based on the specific changes you need to make in the codebase. Review the conditions below and read the relevant documentation before proceeding with your task.

## Instructions
- Review the task you've been asked to perform
- Check each documentation path in the Conditional Documentation section
- For each path, evaluate if any of the listed conditions apply to your task
  - IMPORTANT: Only read the documentation if any one of the conditions match your task
- IMPORTANT: You don't want to excessively read documentation. Only read the documentation if it's relevant to your task.

## Conditional Documentation

- README.md
  - Conditions:
    - When operating on anything under app/split-lease/components
    - When operating on anything under app/split-lease/pages
    - When operating on anything under app/test-harness
    - When first understanding the project structure
    - When you want to learn the commands to build components or run tests

- .claude/commands/classify_adw.md
  - Conditions:
    - When adding or removing new `adws/adw_*.py` files

- adws/README.md
  - Conditions:
    - When you're operating in the `adws/` directory

- app_docs/feature-490eb6b5-one-click-table-exports.md
  - Conditions:
    - When working with CSV export functionality
    - When implementing table or query result export features
    - When troubleshooting download button functionality
    - When working with pandas-based data export utilities

- app_docs/feature-4c768184-model-upgrades.md
  - Conditions:
    - When working with LLM model configurations
    - When updating OpenAI or Anthropic model versions
    - When troubleshooting SQL query generation accuracy
    - When working with the llm_processor module

- app_docs/feature-f055c4f8-off-white-background.md
  - Conditions:
    - When working with application background styling
    - When modifying CSS color variables or themes
    - When implementing visual design changes to the client application

- app_docs/feature-6445fc8f-light-sky-blue-background.md
  - Conditions:
    - When working with light sky blue background styling
    - When implementing background color changes to light blue variants
    - When troubleshooting visual hierarchy with light blue backgrounds

- app_docs/feature-cc73faf1-upload-button-text.md
  - Conditions:
    - When working with upload button text or labeling
    - When implementing UI text changes for data upload functionality
    - When troubleshooting upload button display or terminology

- app_docs/feature-fdaa1bc9-listing-images-proposal-menu.md
  - Conditions:
    - When working with the view split lease page
    - When implementing listing image display or gallery features
    - When working with rental proposal booking panels or forms
    - When implementing weekly schedule selectors for rental bookings
    - When working with reservation span configurations
    - When implementing real-time pricing calculations for rentals
    - When troubleshooting ListingImageGrid or ProposalMenu components

- app_docs/feature-0bed8d36-header-esm-islands.md
  - Conditions:
    - When working with the Header navigation component
    - When implementing or modifying ESM + React Islands architecture
    - When migrating components to CSS Modules
    - When setting up Vitest testing infrastructure
    - When implementing island mount scripts for vanilla HTML integration
    - When troubleshooting Header component styling, dropdowns, or mobile menu
    - When implementing accessibility features (WCAG 2.1 AA compliance)
    - When working with data attribute parsing for island mounting
