import { Card, Typography } from 'antd';

const { Title } = Typography;

export default function AdminPage() {
  return (
    <div className="p-6">
      <Card>
        <Title level={3}>Admin Page</Title>
      </Card>
    </div>
  );
}

