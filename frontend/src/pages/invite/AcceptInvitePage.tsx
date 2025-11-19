import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Typography, Input, Button, Space, Alert, message } from 'antd';
import inviteService from '@/services/inviteService';
import { TeamOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function AcceptInvitePage() {
  const query = useQuery();
  const navigate = useNavigate();

  const [token, setToken] = useState('');
  const [checking, setChecking] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<any | null>(null);
  const [accepted, setAccepted] = useState(false);

  // Lấy token từ URL query nếu có (?token=xxx)
  useEffect(() => {
    const urlToken = query.get('token');
    if (urlToken) {
      setToken(urlToken);
      // Optional: auto fetch info
      fetchInviteInfo(urlToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInviteInfo = async (t: string) => {
    if (!t) return;
    try {
      setChecking(true);
      const res = await inviteService.getByToken(t);
      setInviteInfo(res.data);
    } catch (err: any) {
      console.error(err);
      setInviteInfo(null);
      message.error(err?.response?.data || 'Token không hợp lệ hoặc lời mời đã hết hạn');
    } finally {
      setChecking(false);
    }
  };

  const handleCheck = async () => {
    await fetchInviteInfo(token);
  };

  const handleAccept = async () => {
    if (!token) {
      message.warning('Vui lòng nhập token lời mời');
      return;
    }
    try {
      setChecking(true);
      const res = await inviteService.accept(token);
      setAccepted(true);
      message.success('Đã tham gia team thành công!');

      // Nếu backend trả về teamId, có thể điều hướng thẳng về team đó
      const teamId = res.data?.team?._id || res.data?.teamId;
      if (teamId) {
        setTimeout(() => navigate(`/teams/${teamId}`), 800);
      } else {
        setTimeout(() => navigate('/teams'), 800);
      }
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data || 'Không chấp nhận được lời mời');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-lg w-full">
        <Space direction="vertical" className="w-full" size="large">
          <div className="text-center">
            <Title level={3} className="m-0">
              Tham gia team bằng lời mời
            </Title>
            <Text type="secondary">
              Dán token bạn nhận được qua email / chat để tham gia vào team.
            </Text>
          </div>

          <Space direction="vertical" className="w-full">
            <Text strong>Token lời mời</Text>
            <Input
              placeholder="Ví dụ: abcd1234xyz..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <Space>
              <Button onClick={handleCheck} loading={checking} disabled={!token}>
                Kiểm tra
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleAccept}
                loading={checking}
                disabled={!token}
              >
                Chấp nhận lời mời
              </Button>
            </Space>
          </Space>

          {inviteInfo && (
            <Alert
              type="success"
              showIcon
              message={
                <Space direction="vertical">
                  <span>
                    Bạn được mời vào team{' '}
                    <b>
                      {typeof inviteInfo.team === 'string'
                        ? inviteInfo.team
                        : inviteInfo.team?.name || '—'}
                    </b>
                  </span>
                  <span>
                    Email: <b>{inviteInfo.email}</b> · Vai trò:{' '}
                    <b>{inviteInfo.role || 'member'}</b>
                  </span>
                </Space>
              }
            />
          )}

          {accepted && (
            <Alert
              type="info"
              showIcon
              message="Bạn đã tham gia team. Đang chuyển đến trang team..."
            />
          )}

          <Button
            icon={<TeamOutlined />}
            type="link"
            onClick={() => navigate('/teams')}
            className="self-start"
          >
            Về trang quản lý team
          </Button>
        </Space>
      </Card>
    </div>
  );
}
