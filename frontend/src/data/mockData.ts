import type { Task } from '@/types/task';
import type { Project } from '@/types/project';
import type { Team } from '@/types/team';
import type { User } from '@/types/user';
import type { Label } from '@/types/task';

export const DEFAULT_TEAM_ID = 'team-001';

export const mockUsers: User[] = [
  {
    id: 'user-001',
    email: 'hung@gmail.com',
    name: 'Huỳnh Thịnh Hưng',
    avatarUrl: 'https://www.google.com.vn/url?sa=i&url=https%3A%2F%2Fwww.freepik.com%2Ficon%2Fuser-avatar_6596121&psig=AOvVaw2gU4rGOGAGL-eBdhCkBdbw&ust=1763544682056000&source=images&cd=vfe&opi=89978449&ved=0CBUQjRxqFwoTCPCsl4Wy-5ADFQAAAAAdAAAAABAE',
    roles: [{ team: DEFAULT_TEAM_ID, role: 'leader' }],
  },
  {
    id: 'user-002',
    email: 'nthien@gmail.com',
    name: 'Nguyễn Ngọc Thiện',
    avatarUrl: 'https://www.google.com.vn/url?sa=i&url=https%3A%2F%2Fwww.freepik.com%2Ficon%2Fuser-avatar_6596121&psig=AOvVaw2gU4rGOGAGL-eBdhCkBdbw&ust=1763544682056000&source=images&cd=vfe&opi=89978449&ved=0CBUQjRxqFwoTCPCsl4Wy-5ADFQAAAAAdAAAAABAE',
    roles: [{ team: DEFAULT_TEAM_ID, role: 'member' }],
  },
  {
    id: 'user-003',
    email: 'nva@gmail.com',
    name: 'Nguyễn Văn A',
    avatarUrl: 'https://www.google.com.vn/url?sa=i&url=https%3A%2F%2Fwww.freepik.com%2Ficon%2Fuser-avatar_6596121&psig=AOvVaw2gU4rGOGAGL-eBdhCkBdbw&ust=1763544682056000&source=images&cd=vfe&opi=89978449&ved=0CBUQjRxqFwoTCPCsl4Wy-5ADFQAAAAAdAAAAABAE',
    roles: [{ team: DEFAULT_TEAM_ID, role: 'member' }],
  },
];

export const mockLabels: Label[] = [
  { id: 'label-design', name: 'Design', color: '#1677ff' },
  { id: 'label-ai', name: 'AI', color: '#722ed1' },
  { id: 'label-urgent', name: 'Urgent', color: '#ff4d4f' },
];

export const mockProjects: Project[] = [
  {
    id: 'proj-001',
    team: DEFAULT_TEAM_ID,
    name: 'Họp báo cáo giữa kỳ',
    key: 'RP1',
    description: 'Chuẩn bị nội dung và tài liệu cho buổi họp báo cáo giữa kỳ.',
    lead: 'user-001',
    createdAt: '2024-10-01T09:30:00.000Z',
    updatedAt: '2024-11-15T08:15:00.000Z',
  },
  {
    id: 'proj-002',
    team: DEFAULT_TEAM_ID,
    name: 'Dự án CNTT thông minh',
    key: 'CNTT',
    description: 'Xây dựng demo SmartWork AI để trình bày.',
    lead: 'user-002',
    createdAt: '2024-09-15T07:10:00.000Z',
    updatedAt: '2024-11-18T10:45:00.000Z',
  },
  {
    id: 'proj-003',
    team: DEFAULT_TEAM_ID,
    name: 'Báo cáo tiến độ cuối kỳ',
    key: 'RP2',
    description: 'Tổng hợp tiến độ, biểu đồ và số liệu cho lần bảo vệ thứ hai.',
    lead: 'user-003',
    createdAt: '2024-10-20T06:00:00.000Z',
    updatedAt: '2024-11-17T13:20:00.000Z',
  },
];

export const mockTeams: Team[] = [
  {
    id: DEFAULT_TEAM_ID,
    name: 'SmartWork Core Team',
    slug: 'smartwork-core',
    description: 'Team nòng cốt xây dựng SmartWork AI',
    leaders: ['user-001'],
    members: mockUsers.map((user, index) => ({
      user: user.id,
      role: index === 0 ? 'leader' : 'member',
      joinedAt: '2024-06-01T08:00:00.000Z',
    })),
    settings: {
      defaultTaskPriority: 'normal',
      defaultTaskStatus: 'todo',
    },
  },
];

export const mockTasks: Task[] = [
  {
    id: 'TASK-101',
    team: DEFAULT_TEAM_ID,
    project: 'proj-001',
    title: 'Họp báo cáo lần 1',
    description: 'Chuẩn bị slide, phân chia người trình bày cho buổi báo cáo lần 1.',
    status: 'in_progress',
    priority: 'high',
    assignees: ['user-001', 'user-002'],
    labels: ['label-design'],
    dueDate: '2024-11-20T09:00:00.000Z',
    tags: ['họp', 'báo cáo'],
    createdAt: '2024-11-05T08:00:00.000Z',
    updatedAt: '2024-11-16T09:15:00.000Z',
    checklist: [
      { content: 'Hoàn thiện outline', done: true },
      { content: 'Review với GV hướng dẫn', done: false },
    ],
  } as Task,
  {
    id: 'TASK-102',
    team: DEFAULT_TEAM_ID,
    project: 'proj-002',
    title: 'Xây dựng demo dự án CNTT',
    description: 'Ghép các module SmartWork AI để sẵn sàng demo.',
    status: 'todo',
    priority: 'normal',
    assignees: ['user-002'],
    labels: ['label-ai'],
    dueDate: '2024-11-28T13:00:00.000Z',
    tags: ['dự án', 'cntt'],
    createdAt: '2024-11-10T10:00:00.000Z',
    updatedAt: '2024-11-16T12:00:00.000Z',
    checklist: [
      { content: 'Kết nối màn Task Detail', done: false },
      { content: 'Test AI suggestion', done: false },
    ],
  } as Task,
  {
    id: 'TASK-103',
    team: DEFAULT_TEAM_ID,
    project: 'proj-003',
    title: 'Báo cáo tiến độ tổng',
    description: 'Tổng hợp số liệu, biểu đồ, checklist hoàn thành để báo cáo cuối kỳ.',
    status: 'backlog',
    priority: 'normal',
    assignees: ['user-003'],
    labels: ['label-ai'],
    dueDate: '2024-12-05T15:00:00.000Z',
    tags: ['báo cáo', 'tiến độ'],
    createdAt: '2024-11-02T11:30:00.000Z',
    updatedAt: '2024-11-14T14:10:00.000Z',
  } as Task,
  {
    id: 'TASK-104',
    team: DEFAULT_TEAM_ID,
    project: 'proj-001',
    title: 'Báo cáo lần 2 - cập nhật góp ý',
    description: 'Thu thập feedback sau lần 1, cập nhật kịch bản thuyết trình.',
    status: 'done',
    priority: 'low',
    assignees: ['user-001'],
    labels: ['label-urgent'],
    dueDate: '2024-11-18T10:00:00.000Z',
    tags: ['báo cáo'],
    createdAt: '2024-10-28T08:45:00.000Z',
    updatedAt: '2024-11-12T10:30:00.000Z',
  } as Task,
];

export const mockSprints = [
  { id: 'sprint-17', name: 'Sprint 17 - UI polish' },
  { id: 'sprint-16', name: 'Sprint 16 - AI Assistant' },
];

export const getProjectById = (projectId: string) =>
  mockProjects.find((project) => project.id === projectId);

export const getTaskById = (taskId: string) =>
  mockTasks.find((task) => task.id === taskId);

