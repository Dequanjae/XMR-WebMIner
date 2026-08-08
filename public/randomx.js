// RandomX Emscripten glue - simplified for browser use
var createRandomX;

(function() {
  // This is the Emscripten-generated glue code
  // In production, this is the full emscripten output
  // For now, we provide a minimal stub that loads the WASM

  createRandomX = async function(Module) {
    Module = Module || {};

    // Load the WASM binary
    const wasmPath = 'randomx.wasm';
    let wasmBinary;

    try {
      const response = await fetch(wasmPath);
      if (!response.ok) throw new Error('Failed to fetch WASM');
      wasmBinary = await response.arrayBuffer();
    } catch (e) {
      throw new Error('Failed to load RandomX WASM: ' + e.message);
    }

    // Instantiate the WASM module
    const wasmModule = await WebAssembly.instantiate(wasmBinary, {
      env: { memory: new WebAssembly.Memory({ initial: 256, maximum: 65536, shared: true }) },
      wasi_snapshot_preview1: { proc_exit: () => {} }
    });

    Module.HEAPU8 = new Uint8Array(wasmModule.instance.exports.memory.buffer);
    Module.HEAPU32 = new Uint32Array(wasmModule.instance.exports.memory.buffer);
    Module.HEAP64 = new BigUint64Array(wasmModule.instance.exports.memory.buffer);

    // Map exported functions
    const exports = wasmModule.instance.exports;
    Module._randomx_alloc_cache = exports.randomx_alloc_cache;
    Module._randomx_init_cache = exports.randomx_init_cache;
    Module._randomx_alloc_dataset = exports.randomx_alloc_dataset;
    Module._randomx_init_dataset = exports.randomx_init_dataset;
    Module._randomx_dataset_item_count = exports.randomx_dataset_item_count;
    Module._randomx_create_vm = exports.randomx_create_vm;
    Module._randomx_vm_set_cache = exports.randomx_vm_set_cache;
    Module._randomx_vm_set_dataset = exports.randomx_vm_set_dataset;
    Module._randomx_calculate_hash = exports.randomx_calculate_hash;
    Module._randomx_calculate_hash_first = exports.randomx_calculate_hash_first;
    Module._randomx_calculate_hash_next = exports.randomx_calculate_hash_next;
    Module._randomx_calculate_hash_last = exports.randomx_calculate_hash_last;
    Module._randomx_destroy_vm = exports.randomx_destroy_vm;
    Module._randomx_release_cache = exports.randomx_release_cache;
    Module._randomx_release_dataset = exports.randomx_release_dataset;
    Module._randomx_get_flags = exports.randomx_get_flags;
    Module._randomx_get_dataset_memory = exports.randomx_get_dataset_memory;
    Module._malloc = exports.malloc;
    Module._free = exports.free;

    if (Module.onRuntimeInitialized) Module.onRuntimeInitialized();

    return Module;
  };
})();
