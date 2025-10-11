import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Briefcase, MessageCircle, Shield, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { Navigate } from 'react-router-dom'

export default function LandingPage() {
  const { user } = useAuthStore()

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-100 via-accent-50 to-slate-100 opacity-60"></div>
        
        <div className="relative max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-primary-600 to-accent-600 rounded-2xl flex items-center justify-center shadow-2xl">
                <span className="text-white font-bold text-4xl">L</span>
              </div>
            </div>

            <h1 className="text-6xl md:text-7xl font-display font-bold mb-6">
              <span className="text-gradient">Find Your Perfect</span>
              <br />
              <span className="text-slate-900">PBL Team at GEHU</span>
            </h1>

            <p className="text-xl text-slate-600 mb-12 max-w-2xl mx-auto">
              Connect with talented teammates, showcase your skills, and build amazing projects together.
              Made exclusively for GEHU students.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup" className="btn-primary inline-flex items-center justify-center space-x-2">
                <span>Get Started</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/login" className="btn-secondary">
                Sign In
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-slate-900 mb-4">
              Everything You Need
            </h2>
            <p className="text-lg text-slate-600">
              Built with modern features to make team finding effortless
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Users className="w-8 h-8" />}
              title="Team Management"
              description="Create and manage teams of 3-4 members with automatic PBL rule enforcement"
              color="from-blue-500 to-cyan-500"
            />
            <FeatureCard
              icon={<Briefcase className="w-8 h-8" />}
              title="Smart Recruitment"
              description="Post openings, review applications, and find the perfect teammates"
              color="from-purple-500 to-pink-500"
            />
            <FeatureCard
              icon={<MessageCircle className="w-8 h-8" />}
              title="Built-in Messaging"
              description="DM, team chats, and recruitment discussions - all in one place"
              color="from-green-500 to-emerald-500"
            />
            <FeatureCard
              icon={<Shield className="w-8 h-8" />}
              title="Privacy First"
              description="No phone sharing. Your contact info stays private and secure"
              color="from-orange-500 to-red-500"
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-slate-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-slate-600">
              Get started in minutes
            </p>
          </div>

          <div className="space-y-8">
            <Step
              number="1"
              title="Sign Up & Verify"
              description="Create an account and verify your GEHU email to unlock all features"
            />
            <Step
              number="2"
              title="Build Your Profile"
              description="Add your skills, year, section, and optional GitHub/LinkedIn profiles"
            />
            <Step
              number="3"
              title="Find Your Team"
              description="Browse recruitment posts, apply to teams, or create your own team"
            />
            <Step
              number="4"
              title="Collaborate & Succeed"
              description="Use built-in messaging to coordinate and build amazing projects together"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary-600 to-accent-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-display font-bold text-white mb-6">
            Ready to Find Your Dream Team?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join hundreds of GEHU students already using Linkup
          </p>
          <Link to="/signup" className="bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold text-lg hover:shadow-2xl transition-all duration-200 inline-flex items-center space-x-2">
            <span>Create Free Account</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-600 to-accent-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">L</span>
          </div>
          <p className="mb-4">© 2025 Linkup. Made for GEHU Students.</p>
          <p className="text-sm">Built with ❤️ for better collaboration</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description, color }: any) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="card text-center"
    >
      <div className={`w-16 h-16 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg`}>
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600">{description}</p>
    </motion.div>
  )
}

function Step({ number, title, description }: any) {
  return (
    <div className="flex items-start space-x-4">
      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-primary-600 to-accent-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
        {number}
      </div>
      <div className="flex-1 pt-2">
        <h3 className="text-xl font-semibold text-slate-900 mb-2 flex items-center">
          {title}
          <CheckCircle2 className="w-5 h-5 text-green-500 ml-2" />
        </h3>
        <p className="text-slate-600">{description}</p>
      </div>
    </div>
  )
}
