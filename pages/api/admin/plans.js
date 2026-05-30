import db from "../../../components/db";
import lib from "../../../components/lib";
import {
  slugifyId,
  sortPlansByAmount,
  registerPlanOnProducts,
  removePlanFromProducts,
} from "../../../lib/planCatalog";

const { Plan, Product } = db;
const { midd, success } = lib;

export default async (req, res) => {
  await midd(req, res);

  if (req.method == "GET") {
    const raw = await Plan.find({});
    const plans = sortPlansByAmount(
      raw.map((plan) => ({
        ...plan,
        affiliation_active: plan.affiliation_active !== false,
      }))
    );

    return res.json(
      success({
        plans,
      })
    );
  }

  if (req.method == "POST") {
    const { action } = req.body;

    if (action == "edit") {
      const { id } = req.body;
      const {
        _name,
        _amount,
        _img,
        _affiliation_points,
        _n,
        _max_products,
        _kit,
        _affiliation_active,
      } = req.body.data;

      await Plan.update(
        { id },
        {
          $set: {
            name: _name,
            amount: _amount,
            img: _img,
            affiliation_points: _affiliation_points,
            n: _n,
            max_products: _max_products,
            kit: _kit,
            affiliation_active: _affiliation_active !== false,
          },
        }
      );
    }

    if (action == "add") {
      const {
        id: rawId,
        name,
        amount,
        img,
        affiliation_points,
        n,
        max_products,
        kit,
        affiliation_active,
      } = req.body.data;

      const id = slugifyId(rawId || name);
      if (!id) {
        return res.status(400).json({ error: "ID de plan inválido" });
      }

      const existing = await Plan.findOne({ id });
      if (existing) {
        return res.status(400).json({ error: "Ya existe un plan con ese ID" });
      }

      await Plan.insert({
        id,
        name: name || id.toUpperCase(),
        amount: Number(amount) || 0,
        img: img || "",
        affiliation_points: Number(affiliation_points) || 0,
        n: Number(n) || 0,
        max_products: Number(max_products) || 0,
        kit: Number(kit) || 0,
        affiliation_active: affiliation_active !== false,
      });

      await registerPlanOnProducts(Product, id, false);
    }

    if (action == "delete") {
      const { id } = req.body;
      await removePlanFromProducts(Product, id);
      await Plan.delete({ id });
    }

    return res.json(success({}));
  }

  if (req.method == "PUT") {
    let plan = await Plan.update(req.body);
    return res.json(success({ plan }));
  }

  if (req.method == "DELETE") {
    let plan = await Plan.delete(req.body);
    return res.json(success({ plan }));
  }
};
