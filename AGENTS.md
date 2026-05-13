# Rex.SmomPublish Project Agents Documentation

This document outlines the key functional modules ("agents") within the Rex.SmomPublish application, which is a Vue 3-based project management and publishing system.

## Core Architecture

- **Framework**: Vue 3 (Composition API)
- **Build Tool**: Vite
- **UI Structure**: Modular layout system with:
  - Multiple layout types (classic, columns, defaults, transverse)
  - Navigation components (aside, header, tags view, breadcrumb)
  - Responsive design patterns

## Functional Agents

### 1. Papers Publishing Agent
**Purpose**: Manages document publishing workflows
- **Key Components**:
  - `src/views/papersPublish/index.vue` - Main publishing interface
  - `src/views/papersPublish/components/localPublishItem.vue` - Handles local publishing operations
  - `src/views/papersPublish/components/remotePublishItem.vue` - Manages remote publishing operations
- **Features**:
  - Dual publishing channels (local/remote)
  - Visual status indicators
  - Publishing history tracking

### 2. Project Management Agent
**Purpose**: Handles project configuration and lifecycle
- **Key Components**:
  - `src/views/project/index.vue` - Project dashboard
  - `src/views/project/components/projectDialog.vue` - Project creation/modification interface
- **Features**:
  - Project configuration management
  - Visual project organization
  - Integration with publishing workflows

### 3. Server Management Agent
**Purpose**: Manages server configurations and connections
- **Key Components**:
  - `src/views/servers/index.vue` - Server management interface
  - `src/views/servers/components/serverDialog.vue` - Server configuration dialog
  - `src/views/sshInstall/index.vue` - SSH installation workflow
- **Features**:
  - Multiple server configuration support
  - SSH key management
  - Connection testing capabilities

### 4. Version Control Agents

#### Git Integration Agent
**Purpose**: Provides Git repository management
- **Key Components**:
  - `src/views/git/index.vue` - Git interface
  - `src/views/git/components/gitDialog.vue` - Repository operations
  - `src/views/git/components/gitLogDialog.vue` - Commit history viewer
- **Features**:
  - Repository initialization
  - Commit history visualization
  - Branch management

#### Team Foundation Server (TFS) Agent
**Purpose**: Integrates with Microsoft TFS repositories
- **Key Components**:
  - `src/views/teamFoundationServer/index.vue` - TFS interface
  - `src/views/teamFoundationServer/components/tfsDialog.vue` - TFS connection management
  - `src/views/teamFoundationServer/components/historyDialog.vue` - TFS history viewer
- **Features**:
  - TFS repository connectivity
  - Work item tracking integration
  - History and log management

### 5. Backup & Restore Agent
**Purpose**: Handles application configuration backups
- **Key Components**:
  - `src/views/backups/index.vue` - Backup management interface
  - Multiple restore dialog components for different restore methods
- **Features**:
  - Local and remote backup options
  - Versioned restore points
  - Backup verification

### 6. Application Configuration Agent
**Purpose**: Manages global application settings
- **Key Components**:
  - `src/views/appconfig/index.vue` - Configuration dashboard
  - `src/views/appconfig/components/appconfigDialog.vue` - Detailed configuration editor
- **Features**:
  - Modular configuration sections
  - Real-time preview capabilities
  - Configuration validation

## UI Infrastructure

- **Layout System**: Multiple layout strategies implemented in `src/layout/`
- **Component Library**: Reusable components in `src/components/`
- **Icon System**: SVG-based icon management through `src/components/svgIcon/`
- **State Management**: Vuex or Pinia (not explicitly visible in file structure)

## Technical Dependencies

- **Build**: Vite with plugins like `vite-plugin-compression`
- **UI Components**: Custom layout system with grid capabilities
- **Utilities**: Comprehensive set of utility libraries for path handling, validation, etc.

This documentation reflects the current structure as of 2026-05-13. For implementation details, refer to the specific component files listed above.