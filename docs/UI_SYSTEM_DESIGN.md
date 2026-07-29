# 🎨 Enterprise UI System Design

## 🎯 Mục tiêu

Nâng cấp giao diện lên cấp độ **Enterprise ERP** với:
- ✅ **Adaptive UI** - Giao diện thay đổi theo role
- ✅ **Full CRUD** - Thêm, sửa, xóa, xem chi tiết
- ✅ **Advanced Filtering** - Lọc đa điều kiện
- ✅ **Smart Pagination** - Server-side pagination
- ✅ **Bulk Operations** - Thao tác hàng loạt
- ✅ **Quick Actions** - Shortcuts cho operations
- ✅ **Responsive Design** - Mobile-first
- ✅ **Export/Import** - Excel, PDF, CSV

---

## 📦 Component Architecture

### 1. **DataTable Component** (Core)
```
DataTable/
├── DataTable.tsx           # Main table component
├── DataTableHeader.tsx     # Toolbar with search, filter, actions
├── DataTableRow.tsx        # Smart row with inline actions
├── DataTablePagination.tsx # Server-side pagination
├── DataTableFilters.tsx    # Advanced filter panel
├── DataTableBulk.tsx       # Bulk action toolbar
└── DataTableEmpty.tsx      # Empty state
```

**Features:**
- Column sorting (client + server)
- Column visibility toggle
- Row selection (single/multi)
- Inline editing
- Expandable rows
- Sticky header
- Virtual scrolling (large datasets)

### 2. **Form Components**
```
Forms/
├── SmartForm.tsx          # Auto-generate form from schema
├── FormField.tsx          # Adaptive field component
├── FormSection.tsx        # Collapsible sections
├── FormWizard.tsx         # Multi-step forms
├── FormValidation.tsx     # Real-time validation
└── FormPreview.tsx        # Preview before submit
```

**Features:**
- Schema-driven forms
- Conditional fields
- Auto-save drafts
- Validation rules
- File upload with preview
- Rich text editor
- Date/time pickers

### 3. **Modal System**
```
Modals/
├── Modal.tsx              # Base modal
├── SlideOver.tsx          # Side panel
├── ConfirmDialog.tsx      # Confirmation
├── QuickView.tsx          # Quick preview
└── FullScreen.tsx         # Full screen modal
```

### 4. **Action Menus**
```
Actions/
├── ActionButton.tsx       # Single action
├── ActionMenu.tsx         # Dropdown menu
├── ContextMenu.tsx        # Right-click menu
├── FloatingAction.tsx     # FAB button
└── BulkActions.tsx        # Multi-select actions
```

---

## 🎭 Role-Based UI Variations

### DIRECTOR
```typescript
UI Features:
- ✅ Full CRUD operations
- ✅ Bulk actions (delete, export, transfer)
- ✅ Advanced filters (all fields)
- ✅ Export to Excel/PDF
- ✅ Audit log viewer
- ✅ Settings & configuration
- ✅ Branch selector
- ✅ Impersonate user
```

### ACCOUNTANT
```typescript
UI Features:
- ✅ View + Edit (financial data)
- ✅ Export financial reports
- ✅ Advanced filters (financial fields)
- ✅ Approval workflows
- ❌ No delete operations
- ❌ No user management
```

### RECEPTIONIST
```typescript
UI Features:
- ✅ View + Create + Edit
- ✅ Quick actions (enroll, payment)
- ✅ Basic filters
- ✅ Print receipts
- ❌ No delete
- ❌ No financial reports
- ❌ No export to Excel
```

### TEACHER
```typescript
UI Features:
- ✅ View only (students, classes)
- ✅ Mark attendance
- ✅ View schedule
- ❌ No create/edit/delete
- ❌ No export
- ❌ Limited filters
```

### BRANCH_MANAGER
```typescript
UI Features:
- ✅ Full CRUD (branch scope)
- ✅ Bulk actions
- ✅ Advanced filters
- ✅ Export reports
- ✅ User management (branch)
- ❌ No cross-branch operations
```

---

## 🚀 Implementation Plan

### Phase 1: Core Components (Week 1)
- [ ] DataTable with sorting/pagination
- [ ] SmartForm with validation
- [ ] Modal system
- [ ] Action menus

### Phase 2: Advanced Features (Week 2)
- [ ] Advanced filtering
- [ ] Bulk operations
- [ ] Export/Import
- [ ] Quick actions

### Phase 3: Role Adaptation (Week 3)
- [ ] Conditional rendering by role
- [ ] Dynamic action menus
- [ ] Permission-based forms
- [ ] Adaptive filters

### Phase 4: Polish & Optimization (Week 4)
- [ ] Mobile responsiveness
- [ ] Performance optimization
- [ ] Accessibility (ARIA)
- [ ] Dark mode support

---

## 📋 Example: Students Management UI

### DIRECTOR View
```
┌─────────────────────────────────────────────────────────────┐
│ 👤 Học viên (342)                    🔍 [Search...]  [Filter▾] │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ☐ Select All  |  ⬇ Export  |  🗑 Delete  |  ↗ Transfer  │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ☐  [Avatar] Nguyễn Văn A      HV001    CS1    ✅ ACTIVE  │ │
│ │    ⏰ 12 buổi | 💰 1,200,000đ  👁 View  ✏ Edit  🗑 Delete │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ ☐  [Avatar] Trần Thị B        HV002    CS2    ⏸ PAUSED  │ │
│ │    ⏰ 8 buổi | 💰 800,000đ    👁 View  ✏ Edit  🗑 Delete  │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                               │
│ [1] 2 3 ... 35                              Showing 1-10/342 │
└─────────────────────────────────────────────────────────────┘
```

### TEACHER View
```
┌─────────────────────────────────────────────────────────────┐
│ 👤 Học viên của tôi (24)                  🔍 [Search...]     │
│                                                               │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ [Avatar] Nguyễn Văn A      HV001    Lớp FF3-01           │ │
│ │ ⏰ Điểm danh: 12/15 buổi   💰 Học phí: Đã đóng           │ │
│ │                                            👁 Xem chi tiết │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ [Avatar] Trần Thị B        HV002    Lớp FF2-03           │ │
│ │ ⏰ Điểm danh: 8/15 buổi    💰 Học phí: Còn nợ            │ │
│ │                                            👁 Xem chi tiết │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                               │
│ [1] 2 3                                    Showing 1-10/24   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Design Tokens

### Colors (Role-based)
```typescript
const ROLE_COLORS = {
  DIRECTOR: {
    primary: "#6366f1",    // Indigo
    accent: "#8b5cf6",     // Violet
    bg: "from-indigo-500 to-violet-500"
  },
  ACCOUNTANT: {
    primary: "#059669",    // Emerald
    accent: "#10b981",
    bg: "from-emerald-500 to-teal-500"
  },
  RECEPTIONIST: {
    primary: "#0ea5e9",    // Sky
    accent: "#06b6d4",
    bg: "from-sky-500 to-cyan-500"
  },
  TEACHER: {
    primary: "#f59e0b",    // Amber
    accent: "#f97316",
    bg: "from-amber-500 to-orange-500"
  },
  BRANCH_MANAGER: {
    primary: "#8b5cf6",    // Violet
    accent: "#a78bfa",
    bg: "from-violet-500 to-purple-500"
  }
};
```

### Typography
```css
--font-display: "Inter", system-ui;
--font-body: "Inter", sans-serif;
--font-mono: "Fira Code", monospace;

--text-xs: 0.75rem;   /* 12px */
--text-sm: 0.875rem;  /* 14px */
--text-base: 1rem;    /* 16px */
--text-lg: 1.125rem;  /* 18px */
--text-xl: 1.25rem;   /* 20px */
--text-2xl: 1.5rem;   /* 24px */
```

### Spacing
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
```

---

## 📱 Responsive Breakpoints

```typescript
const BREAKPOINTS = {
  mobile: "320px",      // Small phones
  sm: "640px",          // Phones
  md: "768px",          // Tablets
  lg: "1024px",         // Laptops
  xl: "1280px",         // Desktops
  "2xl": "1536px",      // Large screens
};
```

### Mobile-First Design
```
Mobile (< 640px):
- Single column layout
- Stacked forms
- Bottom sheet modals
- Touch-friendly buttons (min 44px)
- Swipe actions

Tablet (640px - 1024px):
- 2 column layout
- Side sheet modals
- Floating action button
- Optimized tables

Desktop (> 1024px):
- Multi-column layout
- Sidebar navigation
- Hover states
- Keyboard shortcuts
- Context menus
```

---

## ⚡ Performance Optimizations

### 1. Virtual Scrolling
```typescript
// For tables with 1000+ rows
<VirtualTable
  items={students}
  rowHeight={72}
  overscan={10}
  renderRow={(student) => <StudentRow {...student} />}
/>
```

### 2. Lazy Loading
```typescript
// Load heavy components on demand
const DataTable = lazy(() => import("@/components/DataTable"));
const ChartDashboard = lazy(() => import("@/components/Charts"));
```

### 3. Debounced Search
```typescript
// Wait 300ms after user stops typing
const debouncedSearch = useDebouncedCallback(
  (query) => fetchStudents(query),
  300
);
```

### 4. Optimistic Updates
```typescript
// Update UI immediately, rollback on error
const { mutate } = useSWR("/api/students");
mutate(
  async (data) => {
    const updated = await updateStudent(id, changes);
    return [...data, updated];
  },
  { optimisticData: [...data, optimisticStudent], rollbackOnError: true }
);
```

---

## 🔐 Security Considerations

### Client-Side Protection
```typescript
// Hide sensitive actions based on permissions
{hasPermission("student.delete.branch") && (
  <Button onClick={handleDelete}>Delete</Button>
)}

// Disable fields user can't edit
<Input 
  disabled={!hasPermission("student.update.branch")}
/>

// Mask sensitive data
{hasPermission("financial.view_sensitive.branch") 
  ? student.tuitionAmount 
  : "***"}
```

### Server-Side Validation
```typescript
// Always validate on server
export const POST = withPermission("student.create.branch", async (req) => {
  const body = await req.json();
  const validated = studentSchema.parse(body);
  // ... create student
});
```

---

## ✅ Next Steps

1. ✅ Tạo DataTable component base
2. ✅ Tạo SmartForm với validation
3. ✅ Implement role-based UI rendering
4. ✅ Add bulk operations
5. ✅ Create export functionality
6. ✅ Optimize for mobile
7. ✅ Add keyboard shortcuts
8. ✅ Performance testing

Bạn muốn tôi bắt đầu implement từ component nào trước?
- [ ] DataTable (Students listing)
- [ ] SmartForm (Student create/edit)
- [ ] Dashboard (Overview with widgets)
- [ ] Advanced Filtering
