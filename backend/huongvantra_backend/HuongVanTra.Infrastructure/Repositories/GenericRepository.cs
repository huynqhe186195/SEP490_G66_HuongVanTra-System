using HuongVanTra.Core.Interfaces;
using HuongVanTra.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace HuongVanTra.Infrastructure.Repositories {
    public class GenericRepository<T> : IGenericRepository<T> where T : class {
        protected readonly AppDbContext _context;
        protected readonly DbSet<T> _dbSet;

        public GenericRepository(AppDbContext context) {
            _context = context;
            _dbSet = context.Set<T>();
        }

        public IQueryable<T> GetQueryable() {
            return _dbSet.AsQueryable();
        }

        public async Task<T?> GetByIdAsync(object id) {
            return await _dbSet.FindAsync(id);
        }

        public async Task<IEnumerable<T>> GetAllAsync() {
            return await _dbSet.ToListAsync();
        }

        public async Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> expression) {
            return await _dbSet.Where(expression).ToListAsync();
        }

        public async Task AddAsync(T entity) {
            await _dbSet.AddAsync(entity);
        }

        public async Task AddRangeAsync(IEnumerable<T> entities) {
            await _dbSet.AddRangeAsync(entities);
        }

        public void Update(T entity) {
            _dbSet.Update(entity);
        }

        public void Remove(T entity) {
            _dbSet.Remove(entity);
        }

        public void RemoveRange(IEnumerable<T> entities) {
            _dbSet.RemoveRange(entities);
        }
    }
}