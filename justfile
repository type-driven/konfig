# Dev flags, unstable apis enabled and every permission allowed.
dev_flags := "-A -c ./deno.jsonc"
# Should write strict --allow-xxx flags here for your prod build
prod_flags := "--check --cached-only --no-remote --import-map=vendor/import_map.json --lock ./lock.json"

# Dependency target flags
dep_flags := "--unstable --lock ./lock.json --import-map ./import_map.json"

docs := "examples/*.ts benchmark*.md **/*.md"
bench_files := "./*_bench.ts"
node_files := "./node/*.ts"
source_files := "./*.ts"
test_files := "./*_test.ts"

all_files := "./*.ts ./node/*.ts"

deno_folder := "./"

# Run all tasks. 
default: chores && build

# update deps (+ lock, cahce, vendor), lint and format all files, run tests and benchmarks
chores: update lint format test bench

# build binary, bundle, node module
build: build-lib build-npm

# Update dependencies to latest versions.
udd paths:
	deno run -A https://deno.land/x/udd@0.7.3/main.ts {{paths}}

# Build release

# Clean before build
clean:
	rm -rf bin cov_profile lib npm

# Essentially npm install --lock
deps: reload lock vendor cache

# Dependencies

# Lock when you add new dependencies
lock:
	deno cache {{dep_flags}} --lock-write {{all_files}}

# Reload cache
reload:
	rm -rf vendor
	deno cache -r {{dep_flags}} {{all_files}}

# Vendor the dependencies
# Import map overridden as config sets the vendored import-map.
# Obviously the vendoring can't depend on the import map it outputs.
vendor: 
	deno vendor {{dep_flags}} --force {{all_files}}

# Check for updates
update: && deps
	just udd "{{all_files}}"

# Tasks

# Run the benchmark(s)
# Benchamrks end in `_bench.ts`
bench:
	deno bench {{dep_flags}} {{dev_flags}}

# Build the lib
build-lib: cache
	mkdir -p lib
	deno bundle {{dep_flags}} mod.ts lib/index.js

# Build the npm module VERSION needs to be set e.g. export VERSION=v1.0.0
# @rcorreia FIXME: needs to check what is wrong in windows/wsl env.
build-npm $VERSION="1.0.0": cache
	deno run {{dev_flags}} {{dep_flags}} ./node/build_npm_package.ts {{VERSION}}

# locally cache (locked) dependencies
cache:
	deno cache {{dep_flags}} {{all_files}}

# `deno fmt` docs and files
format:
	deno fmt {{all_files}} {{docs}}

# `deno lint` all files
lint:
	deno lint -c ./deno.jsonc {{all_files}}

# run tests with coverage and doc-tests
test: clean
	deno test {{dep_flags}} {{dev_flags}} --coverage=cov_profile {{test_files}}
	deno test {{dep_flags}} {{dev_flags}} --doc mod.ts

# Profiling
debug:
	deno run --v8-flags=--prof --inspect-brk {{dev_flags}} main.ts

# Publish the npm module from CI
publish: build-npm
	cd npm && npm publish

run $ENTRYPOINT="src/main.ts":
	deno run {{dev_flags}} {{ENTRYPOINT}}