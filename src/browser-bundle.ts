// Entry point for the browser simulator bundle.
// Re-exports everything from the pure rendering core and the pet state machine.
// No Node.js imports anywhere in this transitive tree.
export * from './pet/index.js';
export * from './render/core.js';
