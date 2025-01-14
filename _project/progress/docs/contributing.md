# Contributing to HyperCaps

We love your input! We want to make contributing to HyperCaps as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Environment

### Prerequisites

- Node.js 18+
- pnpm (we use pnpm workspaces)
- Windows 10 or later
- Visual Studio Code (recommended)

### Getting Started

1. **Clone the Repository**

   ```bash
   git clone https://github.com/withseismic/hypercaps.git
   cd hypercaps
   ```

2. **Install Dependencies**

   ```bash
   pnpm install
   ```

3. **Start Development**

   ```bash
   pnpm dev
   ```

4. **Build for Production**

   ```bash
   pnpm build
   ```

## Project Structure

```
hypercaps/
├── apps/
│   ├── hypercaps/          # Main Electron app
│   │   ├── electron/       # Electron main process
│   │   └── src/           # React frontend
│   ├── docs/              # Documentation site
│   └── web/               # Marketing website
├── packages/              # Shared packages
└── _project/             # Project documentation
```

## Development Workflow

1. **Create a Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Write clean, maintainable code
   - Follow our coding standards
   - Add tests where appropriate

3. **Commit Changes**

   ```bash
   git commit -m "feat: add your feature description"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/) specification

4. **Push Changes**

   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create Pull Request**
   - Use our pull request template
   - Reference any related issues
   - Provide clear description of changes

## Coding Standards

### TypeScript Guidelines

- Use TypeScript for all new code
- Declare types explicitly
- Avoid using `any`
- Use interfaces for object shapes
- Follow our [TypeScript style guide](./typescript-style-guide.md)

### React Best Practices

- Use functional components
- Implement proper error boundaries
- Follow React Query patterns
- Use proper TypeScript generics
- Document component props with JSDoc

### Testing

- Write unit tests for new features
- Follow TDD when possible
- Use Vitest for testing
- Maintain good test coverage

## Documentation

### Code Documentation

- Use JSDoc for public APIs
- Include examples in documentation
- Document complex algorithms
- Keep README files up to date

### User Documentation

- Update relevant docs with changes
- Write clear, concise explanations
- Include screenshots where helpful
- Consider different user skill levels

## Pull Request Process

1. **Before Submitting**
   - Update documentation
   - Add/update tests
   - Run all tests locally
   - Format code with Prettier
   - Fix any lint errors

2. **Review Process**
   - Two maintainer approvals required
   - Address review feedback
   - Keep discussions focused
   - Be patient and respectful

3. **After Merging**
   - Delete your branch
   - Update related issues
   - Monitor CI/CD pipeline

## Community

### Discord Community

Join our [Discord server](https://discord.gg/hypercaps) to:

- Get help with development
- Discuss features and bugs
- Connect with other contributors
- Stay updated on project news

### Issue Reporting

1. **Search Existing Issues**
   - Check if issue already exists
   - Look for related discussions
   - Review closed issues

2. **Create New Issue**
   - Use issue templates
   - Provide clear reproduction steps
   - Include system information
   - Add relevant labels

### Feature Requests

1. **Propose Features**
   - Use feature request template
   - Explain the problem solved
   - Describe proposed solution
   - Consider alternatives

2. **Discussion Process**
   - Engage in community feedback
   - Refine the proposal
   - Get maintainer buy-in
   - Plan implementation

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
