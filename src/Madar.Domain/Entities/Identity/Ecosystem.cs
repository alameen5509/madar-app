using Madar.Domain.Enums;
using Madar.Domain.Entities.Core;
namespace Madar.Domain.Entities.Identity;

public class Ecosystem
{
    public Guid Id { get; set; }
    public string Name { get; set; } = default!;
    public Guid OwnerId { get; set; }
    public ApplicationUser Owner { get; set; } = default!;
    public ICollection<UserEcosystemMember> Members { get; set; } = [];
    public ICollection<LifeCircle> LifeCircles { get; set; } = [];
    public ICollection<EcosystemRole> Roles { get; set; } = [];
}

public class UserEcosystemMember
{
    public Guid Id { get; set; }
    public Guid EcosystemId { get; set; }
    public Guid UserId { get; set; }
    public Guid EcosystemRoleId { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
    public Ecosystem Ecosystem { get; set; } = default!;
    public ApplicationUser User { get; set; } = default!;
    public EcosystemRole Role { get; set; } = default!;
}

public class EcosystemRole
{
    public Guid Id { get; set; }
    public Guid EcosystemId { get; set; }
    public string Name { get; set; } = default!;
    public bool IsSystemRole { get; set; }
    public Ecosystem Ecosystem { get; set; } = default!;
    public ICollection<UserPermission> Permissions { get; set; } = [];
    public ICollection<UserEcosystemMember> Members { get; set; } = [];
}

public class UserPermission
{
    public Guid Id { get; set; }
    public Guid? EcosystemRoleId { get; set; }
    public Guid? UserId { get; set; }
    public PermissionKey Key { get; set; }
    public bool IsGranted { get; set; } = true;
    public EcosystemRole? Role { get; set; }
    public ApplicationUser? User { get; set; }
}
