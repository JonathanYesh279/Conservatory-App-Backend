// Mock file middleware
vi.mock('../../middleware/file.middleware.js', () => ({
  streamFile: vi.fn((req, res, next) => {
    // Mock file streaming logic
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="test-document.pdf"'
    })
    res.end('Mocked file content')
  })
}))