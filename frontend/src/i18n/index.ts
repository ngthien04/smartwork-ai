// src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translation resources
const resources = {
  vi: {
    translation: {
      // Common
      common: {
        save: 'Lưu',
        cancel: 'Hủy',
        delete: 'Xóa',
        edit: 'Sửa',
        create: 'Tạo',
        search: 'Tìm kiếm',
        loading: 'Đang tải...',
        error: 'Lỗi',
        success: 'Thành công',
        confirm: 'Xác nhận',
        yes: 'Có',
        no: 'Không',
      },
      
      // Navigation
      nav: {
        dashboard: 'Tổng quan',
        tasks: 'Công việc',
        projects: 'Dự án',
        notes: 'Ghi chú',
        assistant: 'Trợ lý AI',
        calendar: 'Lịch',
        team: 'Thành viên',
        settings: 'Cài đặt',
      },

      // Dashboard
      dashboard: {
        title: 'Tổng quan',
        quickActions: 'Thao tác nhanh',
        recentTasks: 'Công việc gần đây',
        upcomingEvents: 'Sự kiện sắp tới',
        aiPlan: 'Lập kế hoạch với AI',
      },

      // Tasks
      tasks: {
        title: 'Quản lý công việc',
        createTask: 'Tạo công việc',
        editTask: 'Sửa công việc',
        taskTitle: 'Tiêu đề',
        taskDescription: 'Mô tả',
        taskStatus: 'Trạng thái',
        taskPriority: 'Ưu tiên',
        taskDueDate: 'Hạn hoàn thành',
        taskTags: 'Thẻ',
        status: {
          todo: 'Cần làm',
          in_progress: 'Đang làm',
          done: 'Hoàn thành',
          backlog: 'Tồn đọng',
        },
        priority: {
          low: 'Thấp',
          medium: 'Trung bình',
          high: 'Cao',
          urgent: 'Khẩn cấp',
        },
      },

      // Notes
      notes: {
        title: 'Ghi chú',
        createNote: 'Tạo ghi chú',
        editNote: 'Sửa ghi chú',
        noteTitle: 'Tiêu đề',
        noteContent: 'Nội dung',
        aiSummarize: 'AI tóm tắt',
        convertToTasks: 'Chuyển thành công việc',
      },

      // Assistant
      assistant: {
        title: 'Trợ lý AI',
        chatPlaceholder: 'Nhập tin nhắn...',
        sendMessage: 'Gửi',
        newChat: 'Cuộc trò chuyện mới',
        aiPlanning: 'Lập kế hoạch',
        aiSuggestions: 'Đề xuất AI',
      },

      // Calendar
      calendar: {
        title: 'Lịch',
        today: 'Hôm nay',
        week: 'Tuần',
        month: 'Tháng',
        createEvent: 'Tạo sự kiện',
        eventTitle: 'Tiêu đề sự kiện',
        eventStart: 'Bắt đầu',
        eventEnd: 'Kết thúc',
        eventLocation: 'Địa điểm',
        aiSuggestSchedule: 'AI đề xuất lịch',
      },

      // Settings
      settings: {
        title: 'Cài đặt',
        language: 'Ngôn ngữ',
        theme: 'Giao diện',
        notifications: 'Thông báo',
        account: 'Tài khoản',
        logout: 'Đăng xuất',
      },

      // Auth
      auth: {
        login: 'Đăng nhập',
        register: 'Đăng ký',
        email: 'Email',
        password: 'Mật khẩu',
        confirmPassword: 'Xác nhận mật khẩu',
        name: 'Tên',
        forgotPassword: 'Quên mật khẩu?',
        loginSuccess: 'Đăng nhập thành công',
        registerSuccess: 'Đăng ký thành công',
      },

      // Command Palette
      commandPalette: {
        placeholder: 'Nhập lệnh hoặc tìm kiếm...',
        noResults: 'Không tìm thấy kết quả',
        categories: {
          navigation: 'Điều hướng',
          actions: 'Hành động',
          search: 'Tìm kiếm',
        },
      },
    },
  },
  en: {
    translation: {
      // Common
      common: {
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        create: 'Create',
        search: 'Search',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        confirm: 'Confirm',
        yes: 'Yes',
        no: 'No',
      },
      
      // Navigation
      nav: {
        dashboard: 'Dashboard',
        tasks: 'Tasks',
        projects: 'Projects',
        notes: 'Notes',
        assistant: 'AI Assistant',
        calendar: 'Calendar',
        team: 'Team',
        settings: 'Settings',
      },

      // Dashboard
      dashboard: {
        title: 'Dashboard',
        quickActions: 'Quick Actions',
        recentTasks: 'Recent Tasks',
        upcomingEvents: 'Upcoming Events',
        aiPlan: 'Plan with AI',
      },

      // Tasks
      tasks: {
        title: 'Task Management',
        createTask: 'Create Task',
        editTask: 'Edit Task',
        taskTitle: 'Title',
        taskDescription: 'Description',
        taskStatus: 'Status',
        taskPriority: 'Priority',
        taskDueDate: 'Due Date',
        taskTags: 'Tags',
        status: {
          todo: 'To Do',
          in_progress: 'In Progress',
          done: 'Done',
          backlog: 'Backlog',
        },
        priority: {
          low: 'Low',
          medium: 'Medium',
          high: 'High',
          urgent: 'Urgent',
        },
      },

      // Notes
      notes: {
        title: 'Notes',
        createNote: 'Create Note',
        editNote: 'Edit Note',
        noteTitle: 'Title',
        noteContent: 'Content',
        aiSummarize: 'AI Summarize',
        convertToTasks: 'Convert to Tasks',
      },

      // Assistant
      assistant: {
        title: 'AI Assistant',
        chatPlaceholder: 'Type a message...',
        sendMessage: 'Send',
        newChat: 'New Chat',
        aiPlanning: 'AI Planning',
        aiSuggestions: 'AI Suggestions',
      },

      // Calendar
      calendar: {
        title: 'Calendar',
        today: 'Today',
        week: 'Week',
        month: 'Month',
        createEvent: 'Create Event',
        eventTitle: 'Event Title',
        eventStart: 'Start',
        eventEnd: 'End',
        eventLocation: 'Location',
        aiSuggestSchedule: 'AI Suggest Schedule',
      },

      // Settings
      settings: {
        title: 'Settings',
        language: 'Language',
        theme: 'Theme',
        notifications: 'Notifications',
        account: 'Account',
        logout: 'Logout',
      },

      // Auth
      auth: {
        login: 'Login',
        register: 'Register',
        email: 'Email',
        password: 'Password',
        confirmPassword: 'Confirm Password',
        name: 'Name',
        forgotPassword: 'Forgot Password?',
        loginSuccess: 'Login successful',
        registerSuccess: 'Registration successful',
      },

      // Command Palette
      commandPalette: {
        placeholder: 'Type a command or search...',
        noResults: 'No results found',
        categories: {
          navigation: 'Navigation',
          actions: 'Actions',
          search: 'Search',
        },
      },
    },
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'vi', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
