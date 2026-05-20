// ── Types partagés de l'application ──────────────────────────────────────────
// Ce fichier centralise les structures de données.
// Utilisé comme référence pour JSDoc — TypeScript pourra les importer directement.

/**
 * @typedef {Object} DesignRef
 * @property {string} id
 * @property {string} name
 * @property {string} [image]
 */

/**
 * @typedef {Object} Product
 * @property {string}     id
 * @property {string}     model
 * @property {string}     design
 * @property {string}     [designImage]
 * @property {number}     stock
 * @property {number}     [price]
 * @property {number}     [purchasePrice]
 * @property {DesignRef[]} [designs]
 */

/**
 * @typedef {Object} Sale
 * @property {string}  id
 * @property {string}  groupId
 * @property {string}  productId
 * @property {number}  qty
 * @property {number}  price
 * @property {number}  total
 * @property {number}  [totalAfterDiscount]
 * @property {number}  [discountPercent]
 * @property {number}  [discountAmount]
 * @property {string}  [discountReason]
 * @property {string}  date
 * @property {string}  [client]
 * @property {string}  [phone]
 * @property {string}  [quartier]
 * @property {boolean} [delivery]
 * @property {string}  [remarque]
 */

/**
 * @typedef {Object} Movement
 * @property {string} id
 * @property {string} productId
 * @property {"in"|"out"} type
 * @property {number} qty
 * @property {string} [reason]
 * @property {string} date
 * @property {string} [note]
 */

/**
 * @typedef {Object} PriceSettings
 * @property {number} purchasePrice
 * @property {number} sellingPrice
 * @property {string} currency
 */

/**
 * @typedef {Object} Settings
 * @property {string[]}    models
 * @property {DesignRef[]} designs
 * @property {PriceSettings} prices
 */

/**
 * @typedef {Object} AppData
 * @property {Product[]}  products
 * @property {Sale[]}     sales
 * @property {Movement[]} movements
 * @property {Settings}   settings
 * @property {number}     [_chunkCount]
 */

export {};
