/**
 * Document type definitions for the Completeness Check tool.
 * Each type defines required and optional fields the AI should look for.
 *
 * To add a new document type:
 *  1. Add an entry to DOCUMENT_TYPES
 *  2. Add the key to the VBA panel's cmbDocType dropdown list
 */

export const DOCUMENT_TYPES = {
  menu: {
    label: "Menu / Speisekarte",
    requiredFields: [
      { key: "restaurantName", label: "Restaurant name",      hint: "Name of the restaurant or business" },
      { key: "menuItems",     label: "Menu items with prices", hint: "At least one dish/drink with a price" },
      { key: "allergens",     label: "Allergen declarations",  hint: "EU allergen codes (A–N) per item or a footnote legend" },
      { key: "address",       label: "Address",                hint: "Street, city, postal code" },
      { key: "phone",         label: "Phone number",           hint: "Contact phone number" },
      { key: "openingHours",  label: "Opening hours",          hint: "Days and hours of operation" },
    ],
    optionalFields: [
      { key: "website",    label: "Website / Social media" },
      { key: "taxNote",    label: "Tax / VAT note" },
      { key: "additives",  label: "Additive declarations (1–11)" },
      { key: "qrCode",     label: "QR code reference" },
    ],
  },

  businessCard: {
    label: "Business Card / Visitenkarte",
    requiredFields: [
      { key: "personName",   label: "Person's full name",  hint: "First and last name" },
      { key: "jobTitle",     label: "Job title / Role",    hint: "Position or function" },
      { key: "companyName",  label: "Company name",        hint: "Business or organisation name" },
      { key: "phone",        label: "Phone number",        hint: "Mobile or direct line" },
      { key: "email",        label: "Email address",       hint: "Contact email" },
    ],
    optionalFields: [
      { key: "address",  label: "Address" },
      { key: "website",  label: "Website" },
      { key: "social",   label: "Social media handles" },
      { key: "logo",     label: "Logo / brand mark" },
    ],
  },

  flyer: {
    label: "Flyer / Prospekt",
    requiredFields: [
      { key: "headline",      label: "Main headline / offer",    hint: "The primary message or promotion" },
      { key: "contactInfo",   label: "Contact information",      hint: "At least a phone number or email" },
      { key: "callToAction",  label: "Call to action",           hint: "What the reader should do next (visit, call, scan…)" },
    ],
    optionalFields: [
      { key: "date",     label: "Event or validity date" },
      { key: "address",  label: "Address or location" },
      { key: "website",  label: "Website / QR code" },
      { key: "price",    label: "Price or discount amount" },
    ],
  },

  poster: {
    label: "Poster / Plakat",
    requiredFields: [
      { key: "headline",  label: "Main title / headline",  hint: "The primary message, readable from a distance" },
      { key: "date",      label: "Date or period",          hint: "When the event or offer takes place" },
    ],
    optionalFields: [
      { key: "location",  label: "Location / venue" },
      { key: "contact",   label: "Contact information" },
      { key: "price",     label: "Ticket price / entry fee" },
    ],
  },

  invoice: {
    label: "Invoice / Rechnung",
    requiredFields: [
      { key: "invoiceNumber",  label: "Invoice number",             hint: "Unique sequential invoice ID" },
      { key: "invoiceDate",    label: "Invoice date",               hint: "Date of issue" },
      { key: "senderInfo",     label: "Sender details",             hint: "Company name, address, tax ID / Steuernummer" },
      { key: "recipientInfo",  label: "Recipient details",          hint: "Client name and address" },
      { key: "lineItems",      label: "Line items with amounts",    hint: "Description, quantity, and unit price" },
      { key: "totalAmount",    label: "Total amount",               hint: "Final sum including VAT" },
      { key: "vatBreakdown",   label: "VAT breakdown (German law)", hint: "Tax rate and tax amount shown separately" },
      { key: "paymentInfo",    label: "Payment details",            hint: "IBAN / bank account or payment method" },
    ],
    optionalFields: [
      { key: "dueDate",       label: "Payment due date" },
      { key: "taxId",         label: "USt-ID / VAT number" },
      { key: "serviceDate",   label: "Date of service / delivery" },
    ],
  },
};

/** Returns the system prompt for the completeness check */
export function buildCompletenessPrompt(documentType) {
  const doc = DOCUMENT_TYPES[documentType];
  if (!doc) throw new Error(`Unknown documentType: "${documentType}"`);

  const required = doc.requiredFields
    .map((f) => `  - ${f.key}: ${f.label} (${f.hint})`)
    .join("\n");
  const optional = doc.optionalFields
    .map((f) => `  - ${f.key}: ${f.label}`)
    .join("\n");

  return `You are checking a ${doc.label} document for completeness.

REQUIRED fields (flag missing ones):
${required}

OPTIONAL fields (just note if missing, not an error):
${optional}

Carefully read the text and identify which fields are present and which are missing.
Return ONLY a JSON object with this exact structure — no markdown, no explanation:
{
  "missing": ["fieldKey1", "fieldKey2"],
  "present": ["fieldKey1", "fieldKey2"],
  "optional_missing": ["fieldKey1"],
  "notes": ["any other observation about the document"]
}
Field keys must exactly match the keys listed above.`;
}
