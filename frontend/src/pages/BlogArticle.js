import { Link, useParams, Navigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, User, Calendar, Share2 } from 'lucide-react';
import { blogArticles } from '@/data/blogData';
import Footer from '@/components/Footer';

const BlogArticle = () => {
  const { slug } = useParams();
  const article = blogArticles.find(a => a.slug === slug);

  if (!article) {
    return <Navigate to="/blog" />;
  }

  const relatedArticles = blogArticles
    .filter(a => a.id !== article.id && a.category === article.category)
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">P</span>
              </div>
              <span className="text-xl font-bold text-gray-900">PARAS REWARD</span>
            </Link>
            <Link to="/blog">
              <Button variant="ghost" className="flex items-center gap-2 hover:bg-purple-50">
                <ArrowLeft className="h-4 w-4" />
                Back to Blog
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          
          {/* Article Header */}
          <div className="mb-8">
            <div className="inline-block px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold mb-4">
              {article.category}
            </div>
            
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              {article.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-6 text-gray-600 mb-6">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                <span>{article.author}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <span>{article.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <span>{article.readTime}</span>
              </div>
            </div>

            {/* Share Button */}
            <Button variant="outline" className="gap-2">
              <Share2 className="h-4 w-4" />
              Share Article
            </Button>
          </div>

          {/* Featured Image */}
          <div className="mb-10 rounded-2xl overflow-hidden shadow-2xl">
            <img 
              src={article.image} 
              alt={article.title}
              className="w-full h-96 object-cover"
            />
          </div>

          {/* Article Content */}
          <Card className="p-8 sm:p-12 bg-white shadow-xl mb-12">
            <div 
              className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-purple-600 prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          </Card>

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-8">Related Articles</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedArticles.map((related) => (
                  <Card key={related.id} className="bg-white shadow-lg hover:shadow-xl transition-all overflow-hidden group">
                    <div className="relative h-32 overflow-hidden">
                      <img 
                        src={related.image} 
                        alt={related.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
                        {related.title}
                      </h3>
                      <Link to={`/blog/${related.slug}`}>
                        <Button variant="link" className="p-0 h-auto text-purple-600">
                          Read More →
                        </Button>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <Card className="p-10 bg-gradient-to-br from-purple-600 to-pink-600 text-white text-center shadow-2xl">
            <h2 className="text-3xl font-bold mb-4">Start Earning Today</h2>
            <p className="text-xl text-purple-100 mb-6">
              Join thousands of users earning daily with PARAS REWARD
            </p>
            <Link to="/register">
              <Button className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-6 text-lg rounded-xl shadow-xl">
                Create Free Account
              </Button>
            </Link>
          </Card>

        </div>
      </div>

      <Footer />
    </div>
  );
};

export default BlogArticle;
