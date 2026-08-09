function beforeEach(fn) {
  global.beforeEach(function () {
    const result = fn();
    if (result instanceof Promise) waitsForPromise(() => result);
  });
}

function afterEach(fn) {
  global.afterEach(function () {
    const result = fn();
    if (result instanceof Promise) waitsForPromise(() => result);
  });
}

function it(description, fn) {
  global.it(description, function () {
    const result = fn();
    if (result instanceof Promise) waitsForPromise(() => result);
  });
}

function waitsForPromise(fn) {
  const promise = fn();
  global.waitsFor("spec promise to resolve", function (done) {
    promise.then(done, function (error) {
      jasmine.getEnv().currentSpec.fail(error);
      done();
    });
  });
}

module.exports = { afterEach, beforeEach, it };
