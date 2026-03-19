import '@testing-library/jest-dom'

// jsdom doesn't compute CSS so innerText always returns ''. Polyfill it to return textContent.
Object.defineProperty(HTMLElement.prototype, 'innerText', {
  get() {
    return (this as HTMLElement).textContent ?? ''
  },
  configurable: true,
})
