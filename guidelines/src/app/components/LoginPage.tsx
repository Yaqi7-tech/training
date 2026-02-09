import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { supabase } from '@/lib/supabase';
import { Loader2, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onLogin: (userId?: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      // 检查 Supabase 是否已配置
      if (!supabase) {
        setError('系统未配置数据库，请联系技术支持');
        setIsLoading(false);
        return;
      }

      // 使用 Supabase 认证
      if (isRegisterMode) {
        // 注册
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          throw signUpError;
        } else {
          // 注册成功，显示成功提示并切换到登录模式
          setSuccessMessage('注册成功！请登录您的账号。');
          setIsRegisterMode(false);
          setPassword(''); // 清空密码
        }
      } else {
        // 登录
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          throw signInError;
        } else {
          onLogin(data.user?.id);
        }
      }
    } catch (err) {
      console.error('登录错误:', err);
      const errorMessage = err instanceof Error ? err.message : '操作失败，请重试';

      // 友好的错误提示
      if (errorMessage.includes('Invalid login credentials')) {
        setError('邮箱或密码错误，请检查后重试');
      } else if (errorMessage.includes('User already registered')) {
        setError('该邮箱已注册，请切换到登录模式');
      } else if (errorMessage.includes('Email not confirmed')) {
        setError('请先验证您的邮箱');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold text-slate-900 mb-2">
              心理咨询师培训系统
            </h1>
            <p className="text-slate-500">
              {isRegisterMode ? '注册账号' : '登录以开始您的培训评测'}
            </p>
          </div>

          {/* 提示信息 - 只在未配置 Supabase 时显示 */}
          {!supabase && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-800">
                  <p className="font-semibold mb-1">系统未配置数据库</p>
                  <p className="text-red-700">请联系技术支持配置 Supabase 数据库。</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
                required
                disabled={isLoading}
                minLength={6}
              />
            </div>

            {successMessage && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-600">{successMessage}</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-white hover:opacity-90"
              style={{ backgroundColor: '#7BC0CD' }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isRegisterMode ? '注册中...' : '登录中...'}
                </>
              ) : (
                isRegisterMode ? '注册' : '登录'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setError('');
                setSuccessMessage('');
              }}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              {isRegisterMode ? '已有账号？去登录' : '没有账号？去注册'}
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-slate-400 mt-8">
          © 2026 心理咨询师培训评测系统
        </p>
      </div>
    </div>
  );
}
