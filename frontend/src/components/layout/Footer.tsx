import { Layout } from 'antd';
import { MailOutlined } from '@ant-design/icons';

const { Footer: AntFooter } = Layout;

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <AntFooter className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-6">
          {/* Brand Section */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">SmartWork AI</h3>
            <p className="text-sm text-gray-600 mb-4">
              Ứng dụng quản lý công việc thông minh với AI. Giúp team của bạn làm việc hiệu quả hơn.
            </p>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-start space-x-2">
                <MailOutlined className="mt-1 text-gray-500" />
                <div className="flex flex-col">
                  <span className="font-medium text-gray-800">Nguyễn Ngọc Thiện</span>
                  <a
                    href="mailto:nngocthienn2004@gmail.com"
                    className="hover:text-gray-900 transition-colors"
                  >
                    nngocthienn2004@gmail.com
                  </a>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <MailOutlined className="mt-1 text-gray-500" />
                <div className="flex flex-col">
                  <span className="font-medium text-gray-800">Huỳnh Thịnh Hưng</span>
                  <a
                    href="mailto:callmehunghuynh@gmail.com"
                    className="hover:text-gray-900 transition-colors"
                  >
                    callmehunghuynh@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Product Section */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Sản phẩm</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  Tính năng
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  Giá cả
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  AI Features
                </a>
              </li>
            </ul>
          </div>

          {/* Support Section */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Hỗ trợ</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  Tài liệu
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  Hướng dẫn
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  Liên hệ
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-200 pt-6 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-600 mb-2 md:mb-0">
            © {currentYear} SmartWork AI. All rights reserved.
          </p>
          <div className="flex space-x-6">
            <a href="#" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </AntFooter>
  );
}

