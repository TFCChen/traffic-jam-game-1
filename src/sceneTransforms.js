// Cache only local transforms. World matrices must still follow moving parents
// so ray hits, lamp origins and suspension-mounted meshes stay in sync.
export function cacheLocalTransforms(root, moving = new Set()) {
  root.traverse((node) => {
    if (moving.has(node)) return;
    node.updateMatrix();
    node.matrixAutoUpdate = false;
  });
}
