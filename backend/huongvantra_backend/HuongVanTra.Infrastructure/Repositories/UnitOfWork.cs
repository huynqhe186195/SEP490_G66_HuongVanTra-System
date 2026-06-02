using HuongVanTra.Core.Interfaces;
using HuongVanTra.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Storage;

namespace HuongVanTra.Infrastructure.Repositories {
    public class UnitOfWork : IUnitOfWork {
        private readonly AppDbContext _context;
        private IDbContextTransaction? _currentTransaction;

        private readonly Dictionary<Type, object> _repositories;

        public UnitOfWork(AppDbContext context) {
            _context = context;
            _repositories = new Dictionary<Type, object>();
        }

        public IGenericRepository<TEntity> Repository<TEntity>() where TEntity : class {
            var type = typeof(TEntity);

            if (!_repositories.ContainsKey(type)) {
                var repositoryType = typeof(GenericRepository<>);
                var repositoryInstance = Activator.CreateInstance(repositoryType.MakeGenericType(typeof(TEntity)), _context);
                _repositories.Add(type, repositoryInstance!);
            }

            return (IGenericRepository<TEntity>) _repositories[type];
        }

        public async Task<int> SaveChangesAsync() {
            return await _context.SaveChangesAsync();
        }

        public async Task BeginTransactionAsync() {
            if (_currentTransaction != null)
                return;

            _currentTransaction = await _context.Database.BeginTransactionAsync();
        }

        public async Task CommitTransactionAsync() {
            try {
                await _context.SaveChangesAsync();
                if (_currentTransaction != null) {
                    await _currentTransaction.CommitAsync();
                }
            }
            catch {
                await RollbackTransactionAsync();
                throw;
            }
            finally {
                if (_currentTransaction != null) {
                    _currentTransaction.Dispose();
                    _currentTransaction = null;
                }
            }
        }

        public async Task RollbackTransactionAsync() {
            try {
                if (_currentTransaction != null) {
                    await _currentTransaction.RollbackAsync();
                }
            }
            finally {
                if (_currentTransaction != null) {
                    _currentTransaction.Dispose();
                    _currentTransaction = null;
                }
            }
        }

        public void Dispose() {
            _context.Dispose();
            GC.SuppressFinalize(this);
        }
    }
}