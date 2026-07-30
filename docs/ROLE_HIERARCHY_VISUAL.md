# 👥 TACH - ROLE HIERARCHY & ACCESS VISUALIZATION

## 📊 PHÂN CẤP VAI TRÒ

```
                    ┌─────────────────┐
                    │  SUPER_ADMIN 👑 │
                    │  (System Level) │
                    └────────┬────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
         ┌──────▼──────┐          ┌──────▼──────┐
         │   BOARD 🏆  │          │ DIRECTOR 👨‍💼│
         │  (View All) │          │ (Operations)│
         └─────────────┘          └──────┬──────┘
                                         │
                              ┌──────────┴──────────┐
                              │                     │
                    ┌─────────▼─────────┐  ┌────────▼────────┐
                    │ BRANCH_MANAGER 🏢 │  │      HR 👔      │
                    │  (Branch Scope)    │  │ (HR Functions)  │
                    └─────────┬──────────┘  └─────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
    ┌──────▼──────┐   ┌───────▼───────┐  ┌──────▼──────┐
    │ REGISTRAR 📚│   │ ACCOUNTANT 💰 │  │ ADMISSIONS 🎯│
    │  (Academic) │   │  (Financial)  │  │    (Sales)   │
    └─────────────┘   └───────────────┘  └──────────────┘
           │
    ┌──────┴──────┐
    │             │
┌───▼───┐   ┌────▼────┐
│RECEPT │   │ TEACHER │
│  📋   │   │   👨‍🏫   │
└───────┘   └────┬────┘
                 │
            ┌────▼────┐
            │   TA 👥 │
            └─────────┘
```

---

## 🎯 QUYỀN HẠN THEO MODULE

### **LEGEND**:
- 🟢 **Full Access** - CRUD + Delete + Bulk
- 🟡 **Limited Access** - View + Edit (no Delete)
- 🔵 **View Only** - Chỉ xem
- 🔴 **No Access** - Không thể truy cập

---

## 📊 ACCESS MATRIX

```
MODULE          │ SUPER │ BOARD │ DIR │ BRMGR │ REG │ ADM │ RCPT │ ACC │ HR  │ TCH │ TA
────────────────┼───────┼───────┼─────┼───────┼─────┼─────┼──────┼─────┼─────┼─────┼────
Dashboard       │  🟢   │  🔵   │ 🟢  │  🟢   │ 🔵  │ 🔵  │ 🔵   │ 🔵  │ 🔵  │ 🔵  │ 🔵
Leads (CRM)     │  🟢   │  🔵   │ 🟢  │  🟢   │ 🟡  │ 🟢  │ 🟡   │ 🔴  │ 🔴  │ 🔴  │ 🔴
Students        │  🟢   │  🔵   │ 🟢  │  🟢   │ 🟢  │ 🔵  │ 🟡   │ 🔵  │ 🔴  │ 🔵  │ 🔵
Guardians       │  🟢   │  🔵   │ 🟢  │  🟢   │ 🟡  │ 🟡  │ 🟡   │ 🔴  │ 🔴  │ 🔴  │ 🔴
Classes         │  🟢   │  🔵   │ 🟢  │  🟢   │ 🟢  │ 🔴  │ 🔵   │ 🔵  │ 🔴  │ 🟡  │ 🔵
Calendar        │  🟢   │  🔵   │ 🟢  │  🟢   │ 🔵  │ 🟡  │ 🟡   │ 🔴  │ 🔴  │ 🔵  │ 🔵
Timesheets      │  🟢   │  🔵   │ 🟢  │  🟢   │ 🔵  │ 🔴  │ 🔴   │ 🔴  │ 🟢  │ 🟡  │ 🟡
Tuition         │  🟢   │  🔵   │ 🟢  │  🟢   │ 🔴  │ 🔴  │ 🟡   │ 🟢  │ 🔴  │ 🔴  │ 🔴
Inventory       │  🟢   │  🔵   │ 🟢  │  🟢   │ 🔴  │ 🔴  │ 🟡   │ 🟡  │ 🔴  │ 🔴  │ 🔴
Assets          │  🟢   │  🔵   │ 🟢  │  🟢   │ 🔴  │ 🔴  │ 🔴   │ 🟢  │ 🟡  │ 🔴  │ 🔴
Cashbook        │  🟢   │  🔵   │ 🟢  │  🟢   │ 🔴  │ 🔴  │ 🔴   │ 🟢  │ 🔴  │ 🔴  │ 🔴
Payroll         │  🟢   │  🔵   │ 🟢  │  🟢   │ 🔴  │ 🔴  │ 🔴   │ 🟢  │ 🟢  │ 🔵  │ 🔵
Reports         │  🟢   │  🟢   │ 🟢  │  🟢   │ 🔵  │ 🔴  │ 🔴   │ 🟢  │ 🔵  │ 🔴  │ 🔴
Admin           │  🟢   │  🔵   │ 🟢  │  🟡   │ 🔴  │ 🔴  │ 🔴   │ 🔴  │ 🔴  │ 🔴  │ 🔴
```

---

## 🎭 ROLE PERSONAS

### **👑 SUPER_ADMIN**
```
┌────────────────────────────────┐
│  "System God"                  │
├────────────────────────────────┤
│ • Toàn quyền hệ thống          │
│ • Cấu hình database            │
│ • Manage all users/roles       │
│ • Debug & troubleshooting      │
│ • System maintenance           │
└────────────────────────────────┘
Use: IT Department, System Admin
```

### **🏆 BOARD**
```
┌────────────────────────────────┐
│  "Strategic Oversight"         │
├────────────────────────────────┤
│ • View all reports             │
│ • Monitor KPIs                 │
│ • Strategic decisions          │
│ • No day-to-day operations     │
│ • Read-only access             │
└────────────────────────────────┘
Use: Board Members, Executives
```

### **👨‍💼 DIRECTOR**
```
┌────────────────────────────────┐
│  "Chief Operating Officer"     │
├────────────────────────────────┤
│ • Toàn quyền vận hành          │
│ • All branches access          │
│ • Financial decisions          │
│ • Staff management             │
│ • Strategic + Operational      │
└────────────────────────────────┘
Use: Center Director, CEO
```

### **🏢 BRANCH_MANAGER**
```
┌────────────────────────────────┐
│  "Branch Commander"            │
├────────────────────────────────┤
│ • Branch-level authority       │
│ • Team management              │
│ • Branch operations            │
│ • Branch financial control     │
│ • Local decision making        │
└────────────────────────────────┘
Use: Branch Manager, Site Lead
```

### **📚 REGISTRAR**
```
┌────────────────────────────────┐
│  "Academic Controller"         │
├────────────────────────────────┤
│ • Student lifecycle            │
│ • Class scheduling             │
│ • Academic records             │
│ • Enrollment management        │
│ • No financial access          │
└────────────────────────────────┘
Use: Registrar, Academic Admin
```

### **🎯 ADMISSIONS**
```
┌────────────────────────────────┐
│  "Sales & Marketing"           │
├────────────────────────────────┤
│ • Lead generation              │
│ • Sales pipeline               │
│ • Consultations                │
│ • Convert to students          │
│ • CRM focused                  │
└────────────────────────────────┘
Use: Admissions Officer, Sales
```

### **📋 RECEPTIONIST**
```
┌────────────────────────────────┐
│  "Front Desk Hero"             │
├────────────────────────────────┤
│ • Student registration         │
│ • Payment collection           │
│ • Daily operations             │
│ • Customer service             │
│ • No delete permissions        │
└────────────────────────────────┘
Use: Receptionist, Front Desk
```

### **💰 ACCOUNTANT**
```
┌────────────────────────────────┐
│  "Financial Guardian"          │
├────────────────────────────────┤
│ • Tuition management           │
│ • Cashbook control             │
│ • Payroll processing           │
│ • Financial reporting          │
│ • No student management        │
└────────────────────────────────┘
Use: Accountant, Finance Team
```

### **👔 HR**
```
┌────────────────────────────────┐
│  "People Manager"              │
├────────────────────────────────┤
│ • Employee data                │
│ • Attendance tracking          │
│ • Payroll calculation          │
│ • Performance reviews          │
│ • No student access            │
└────────────────────────────────┘
Use: HR Manager, HR Officer
```

### **👨‍🏫 TEACHER**
```
┌────────────────────────────────┐
│  "Classroom Master"            │
├────────────────────────────────┤
│ • Own classes only             │
│ • Mark attendance              │
│ • Session notes                │
│ • View own students            │
│ • View own payslips            │
└────────────────────────────────┘
Use: Teacher, Instructor
```

### **👥 TEACHING_ASSISTANT**
```
┌────────────────────────────────┐
│  "Classroom Support"           │
├────────────────────────────────┤
│ • Assist teachers              │
│ • Limited class access         │
│ • Basic attendance             │
│ • View schedule                │
│ • Minimal permissions          │
└────────────────────────────────┘
Use: Teaching Assistant, Tutor
```

---

## 🔐 PERMISSION SCOPE VISUALIZATION

### **ALL SCOPE** 🌍
```
┌─────────────────────────────────────┐
│         🌍 ALL DATA                 │
├─────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐│
│ │Branch A │ │Branch B │ │Branch C ││
│ │  🏢     │ │  🏢     │ │  🏢     ││
│ └─────────┘ └─────────┘ └─────────┘│
└─────────────────────────────────────┘

Roles: SUPER_ADMIN, BOARD, DIRECTOR
Can access: All branches, all data
```

### **BRANCH SCOPE** 🏢
```
┌─────────────────────────────────────┐
│    🏢 BRANCH B ONLY                 │
├─────────────────────────────────────┤
│   ✗         ┌─────────┐      ✗     │
│ Branch A    │Branch B │   Branch C  │
│   🚫        │  ✓      │     🚫      │
│             └─────────┘              │
└─────────────────────────────────────┘

Roles: BRANCH_MANAGER, REGISTRAR, 
       RECEPTIONIST, ACCOUNTANT, HR
Can access: Assigned branch only
```

### **OWN SCOPE** 👤
```
┌─────────────────────────────────────┐
│       👤 MY DATA ONLY               │
├─────────────────────────────────────┤
│   My Classes      Others' Classes   │
│   ┌─────────┐     ┌─────────┐      │
│   │  ✓      │     │  🚫     │      │
│   └─────────┘     └─────────┘      │
│                                     │
│   My Salary       Others' Salary   │
│   ✓               🚫               │
└─────────────────────────────────────┘

Roles: TEACHER, TEACHING_ASSISTANT
Can access: Own data only
```

---

## 📱 SIDEBAR BY ROLE

### **DIRECTOR** (Full Access)
```
┌──────────────────┐
│ 📊 Dashboard     │
├──────────────────┤
│ VẬN HÀNH         │
│ 🎯 Leads         │
│ 👥 Students      │
│ 👪 Guardians     │
│ 🎓 Classes       │
│ 📅 Calendar      │
│ ⏰ Timesheets    │
├──────────────────┤
│ TÀI CHÍNH        │
│ 💰 Tuition       │
│ 📚 Inventory     │
│ 🏢 Assets        │
│ 💵 Cashbook      │
│ 💳 Payroll       │
├──────────────────┤
│ HỆ THỐNG         │
│ 📊 Reports       │
│ ⚙️  Admin        │
└──────────────────┘
```

### **REGISTRAR** (Academic)
```
┌──────────────────┐
│ 📊 Dashboard     │
├──────────────────┤
│ VẬN HÀNH         │
│ 🎯 Leads         │
│ 👥 Students      │
│ 👪 Guardians     │
│ 🎓 Classes       │
│ 📅 Calendar      │
│ ⏰ Timesheets    │
├──────────────────┤
│ HỆ THỐNG         │
│ 📊 Reports       │
└──────────────────┘
No Financial Access
```

### **ACCOUNTANT** (Financial)
```
┌──────────────────┐
│ 📊 Dashboard     │
├──────────────────┤
│ VẬN HÀNH         │
│ 👥 Students (📖) │
├──────────────────┤
│ TÀI CHÍNH        │
│ 💰 Tuition       │
│ 📚 Inventory     │
│ 🏢 Assets        │
│ 💵 Cashbook      │
│ 💳 Payroll       │
├──────────────────┤
│ HỆ THỐNG         │
│ 📊 Reports       │
└──────────────────┘
No CRM/Class Access
```

### **TEACHER** (Teaching)
```
┌──────────────────┐
│ 📊 Dashboard     │
├──────────────────┤
│ VẬN HÀNH         │
│ 👥 Students (📖) │
│ 🎓 Classes       │
│ 📅 Calendar      │
│ ⏰ Timesheets    │
├──────────────────┤
│ TÀI CHÍNH        │
│ 💳 Payroll (📖)  │
└──────────────────┘
Own Data Only
```

---

## 🎯 QUICK REFERENCE

### **Need to...**

**Enroll a student?**
→ DIRECTOR, BRANCH_MANAGER, REGISTRAR, RECEPTIONIST

**Collect payment?**
→ DIRECTOR, BRANCH_MANAGER, RECEPTIONIST, ACCOUNTANT

**Process payroll?**
→ DIRECTOR, ACCOUNTANT, HR

**Manage leads?**
→ DIRECTOR, BRANCH_MANAGER, ADMISSIONS, RECEPTIONIST

**Mark attendance?**
→ DIRECTOR, BRANCH_MANAGER, REGISTRAR, TEACHER

**View reports?**
→ DIRECTOR, BOARD, BRANCH_MANAGER, REGISTRAR, ACCOUNTANT, HR

**Manage users?**
→ SUPER_ADMIN, DIRECTOR

**Issue books?**
→ DIRECTOR, BRANCH_MANAGER, RECEPTIONIST, ACCOUNTANT

---

## ✅ SUMMARY

✅ **11 vai trò** với phân cấp rõ ràng  
✅ **3 permission scopes** (ALL/BRANCH/OWN)  
✅ **14 modules** với access control  
✅ **Sidebar tự động filter** theo role  
✅ **Visual role badges** với animation  
✅ **Production ready** với full documentation  

**Status**: 🟢 **COMPLETE & VISUAL**

---

**Created**: July 29, 2026  
**Version**: 3.0.0  
**Type**: Visual Reference Guide

